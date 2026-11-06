import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

/**
 * Vidéo de l'animation d'ouverture (`/api/intro/pc` ou `/api/intro/mobile`), en H.264.
 * Adresse sans « .mp4 » : les gestionnaires de téléchargement (ex. IDM) n'interceptent
 * pas la lecture. Gère les requêtes partielles (Range) pour la lecture vidéo.
 */
const FILES: Record<string, string> = { pc: "pc.mp4", mobile: "mobile.mp4" };

export async function GET(request: Request, { params }: { params: Promise<{ format: string }> }) {
  const { format } = await params;
  const name = FILES[format];
  if (!name) return new Response("Introuvable.", { status: 404 });

  const file = path.join(/* turbopackIgnore: true */ process.cwd(), "media", "intro", name);
  let size: number;
  let mtime: Date;
  try {
    ({ size, mtime } = await stat(file));
  } catch {
    return new Response("Introuvable.", { status: 404 });
  }

  // Le navigateur revalide à chaque chargement (no-cache) : 304 sans contenu tant que la
  // vidéo est la même, nouvelle version dès que le fichier est remplacé.
  const etag = `"${size.toString(36)}-${mtime.getTime().toString(36)}"`;
  const headers = new Headers({
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
    ETag: etag,
    "Last-Modified": mtime.toUTCString(),
    "X-Content-Type-Options": "nosniff",
  });

  const known = request.headers.get("if-none-match")?.split(",").map((tag) => tag.trim().replace(/^W\//, ""));
  if (known?.includes(etag) || known?.includes("*")) return new Response(null, { status: 304, headers });

  // Requête partielle ignorée si elle vise une ancienne version du fichier (If-Range).
  const ifRange = request.headers.get("if-range");
  const range = !ifRange || ifRange === etag ? request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/) : null;
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
    return new Response(Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream, { status: 206, headers });
  }

  headers.set("Content-Length", String(size));
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, { status: 200, headers });
}
