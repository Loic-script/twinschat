import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { isInlineMime } from "@/lib/attachments";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { isUuid } from "@/lib/messages";
import { canAccessAttachment } from "@/lib/resources";
import { storagePath } from "@/lib/storage";

const notFound = () => new Response("Fichier introuvable.", { status: 404 });

/** En-tête Content-Disposition avec un nom de fichier sûr (ASCII + version UTF-8). */
function disposition(type: "inline" | "attachment", name: string) {
  const ascii = name.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "_") || "fichier";
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * Sert une pièce jointe au compte connecté, s'il y a accès (voir canAccessAttachment).
 * Gère les requêtes partielles (Range) pour pouvoir avancer dans les vidéos.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return notFound();

  const me = await getSessionUser();
  if (!me) return new Response("Connexion requise.", { status: 401 });
  // Sans droit d'accès : 404, pour ne pas révéler l'existence du fichier.
  const [file] = await query<{ file_name: string; mime_type: string; storage_key: string }>(
    `SELECT a.file_name, a.mime_type, a.storage_key
       FROM attachments a
       LEFT JOIN messages m ON m.id = a.message_id
      WHERE a.id = $1 AND ${canAccessAttachment("$2")}`,
    [id, me.id],
  );
  if (!file) return notFound();

  const path = storagePath(file.storage_key);
  let size: number;
  try {
    size = (await stat(path)).size;
  } catch {
    return notFound();
  }

  // `?download=1` : téléchargement forcé (photos, vidéos, audio s'ouvrent sinon dans le navigateur).
  const forceDownload = new URL(request.url).searchParams.get("download") === "1";
  const inline = !forceDownload && isInlineMime(file.mime_type);
  const headers = new Headers({
    "Content-Type": file.mime_type,
    "Content-Disposition": disposition(inline ? "inline" : "attachment", file.file_name),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=3600",
    "Accept-Ranges": "bytes",
  });
  // Un SVG peut contenir du script : affiché seul, il est isolé (aucun script, aucune ressource externe).
  // Les autres types à risque (HTML…) ne sont jamais affichés : toujours téléchargés.
  if (file.mime_type === "image/svg+xml") {
    headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox");
  }

  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    const stream = Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream;
    return new Response(stream, { status: 206, headers });
  }

  headers.set("Content-Length", String(size));
  const stream = Readable.toWeb(createReadStream(path)) as ReadableStream;
  return new Response(stream, { status: 200, headers });
}
