import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { checkFile, MAX_FILES_PER_MESSAGE, resolveMime } from "@/lib/attachments";
import { getActor, isSpace } from "@/lib/auth";
import { pool, query } from "@/lib/db";
import { isMember, isUuid } from "@/lib/messages";
import { storagePath, uploadDir } from "@/lib/storage";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Reçoit les fichiers d'un message avant son envoi (ou d'un import dans un dossier).
 * Les pièces jointes sont rattachées au message par l'action `sendMessage`.
 * `space` (admin ou user) : espace de la page, qui désigne le compte qui envoie.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Envoi invalide.");
  }

  // Cible : une discussion (pièces jointes d'un message) ou un dossier de ressources (import direct).
  const conversationValue = form.get("conversationId");
  const folderValue = form.get("folderId");
  const conversationId = isUuid(conversationValue) ? conversationValue : null;
  const folderId = isUuid(folderValue) ? folderValue : null;
  if (!conversationId && !folderId) return fail("Destination invalide.");

  const space = form.get("space");
  if (!isSpace(space)) return fail("Espace invalide.");
  const me = await getActor(space);
  if (conversationId && !(await isMember(me.id, conversationId))) return fail("Discussion introuvable.", 403);
  if (folderId) {
    // Import direct : seulement dans un de ses propres dossiers.
    const [folder] = await query("SELECT 1 FROM resource_folders WHERE id = $1 AND created_by = $2", [
      folderId,
      me.id,
    ]);
    if (!folder) return fail("Dossier introuvable.", 404);
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return fail("Aucun fichier reçu.");
  if (files.length > MAX_FILES_PER_MESSAGE) return fail(`${MAX_FILES_PER_MESSAGE} fichiers maximum par message.`);
  for (const file of files) {
    const error = checkFile(file);
    if (error) return fail(error);
  }

  await mkdir(uploadDir(), { recursive: true });
  const written: string[] = [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const attachments = [];
    for (const file of files) {
      const key = randomUUID();
      await writeFile(storagePath(key), Buffer.from(await file.arrayBuffer()));
      written.push(key);
      const { rows: [row] } = await client.query<{
        id: string;
        file_name: string;
        mime_type: string;
        size_bytes: string;
      }>(
        `INSERT INTO attachments (conversation_id, uploaded_by, file_name, mime_type, size_bytes, storage_key)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, file_name, mime_type, size_bytes`,
        [conversationId, me.id, file.name.slice(0, 255), resolveMime(file.name, file.type), file.size, key],
      );
      if (folderId) {
        await client.query(
          "INSERT INTO resource_folder_items (folder_id, attachment_id, added_by) VALUES ($1, $2, $3)",
          [folderId, row.id, me.id],
        );
      }
      attachments.push({
        id: row.id,
        name: row.file_name,
        mimeType: row.mime_type,
        size: Number(row.size_bytes),
      });
    }
    if (folderId) await client.query("UPDATE resource_folders SET updated_at = now() WHERE id = $1", [folderId]);
    await client.query("COMMIT");
    return NextResponse.json({ attachments });
  } catch (err) {
    await client.query("ROLLBACK");
    await Promise.all(written.map((key) => unlink(storagePath(key)).catch(() => {})));
    console.error("Échec de l'envoi de fichiers", err);
    return fail("Impossible d'enregistrer les fichiers.", 500);
  } finally {
    client.release();
  }
}
