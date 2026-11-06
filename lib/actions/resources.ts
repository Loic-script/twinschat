"use server";

import { unlink } from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { getActor, requireAdmin, requireMember } from "@/lib/auth";
import { pool, query } from "@/lib/db";
import { isUuid } from "@/lib/messages";
import { storagePath } from "@/lib/storage";
import type { Space } from "@/lib/types";

/*
 * Dossiers de ressources, communs aux deux espaces. Chaque compte ne gère que ses
 * propres dossiers (resource_folders.created_by) ; seul l'admin partage des éléments.
 */

export type FolderResult = { ok: true; id?: string } | { ok: false; error: string };

const MAX_NAME = 80;
const NOT_FOUND: FolderResult = { ok: false, error: "Dossier introuvable." };

function refresh() {
  revalidatePath("/admin/ressources");
  revalidatePath("/user/ressources");
}

function cleanName(raw: string): { name: string; error?: undefined } | { name?: undefined; error: string } {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return { error: "Donnez un nom au dossier." };
  if (name.length > MAX_NAME) return { error: `${MAX_NAME} caractères maximum.` };
  return { name };
}

/** Normalise une adresse web (https:// ajouté si besoin), sinon `null`. */
function normalizeUrl(value: string) {
  const raw = value.trim();
  if (!raw) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const href = url.toString();
    return href.length <= 2048 ? href : null;
  } catch {
    return null;
  }
}

/** Le dossier existe et appartient à `ownerId`. */
async function ownsFolder(folderId: string, ownerId: string) {
  if (!isUuid(folderId)) return false;
  const rows = await query("SELECT 1 FROM resource_folders WHERE id = $1 AND created_by = $2", [folderId, ownerId]);
  return rows.length > 0;
}

/**
 * Supprime les fichiers importés directement (sans discussion) qui ne sont plus
 * dans aucun dossier : ligne en base et fichier sur disque.
 */
async function purgeOrphanImports(attachmentIds: string[]) {
  if (attachmentIds.length === 0) return;
  const removed = await query<{ storage_key: string }>(
    `DELETE FROM attachments a
      WHERE a.id = ANY($1::uuid[]) AND a.conversation_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM resource_folder_items i WHERE i.attachment_id = a.id)
      RETURNING a.storage_key`,
    [attachmentIds],
  );
  await Promise.all(removed.map((r) => unlink(storagePath(r.storage_key)).catch(() => {})));
}

export async function createFolder(space: Space, rawName: string): Promise<FolderResult> {
  const checked = cleanName(rawName);
  if (checked.error !== undefined) return { ok: false, error: checked.error };
  const me = await getActor(space);
  const [folder] = await query<{ id: string }>(
    "INSERT INTO resource_folders (name, created_by) VALUES ($1, $2) RETURNING id",
    [checked.name, me.id],
  );
  refresh();
  return { ok: true, id: folder.id };
}

export async function renameFolder(space: Space, folderId: string, rawName: string): Promise<FolderResult> {
  const checked = cleanName(rawName);
  if (checked.error !== undefined) return { ok: false, error: checked.error };
  if (!isUuid(folderId)) return { ok: false, error: "Dossier invalide." };
  const me = await getActor(space);
  const updated = await query(
    "UPDATE resource_folders SET name = $2, updated_at = now() WHERE id = $1 AND created_by = $3 RETURNING 1",
    [folderId, checked.name, me.id],
  );
  if (updated.length === 0) return NOT_FOUND;
  refresh();
  return { ok: true };
}

/** Supprime le dossier. Les fichiers partagés dans les discussions restent dans leurs discussions. */
export async function deleteFolder(space: Space, folderId: string): Promise<FolderResult> {
  if (!isUuid(folderId)) return { ok: false, error: "Dossier invalide." };
  const me = await getActor(space);
  if (!(await ownsFolder(folderId, me.id))) return NOT_FOUND;
  const items = await query<{ attachment_id: string }>(
    "SELECT attachment_id FROM resource_folder_items WHERE folder_id = $1 AND attachment_id IS NOT NULL",
    [folderId],
  );
  const deleted = await query("DELETE FROM resource_folders WHERE id = $1 AND created_by = $2 RETURNING 1", [
    folderId,
    me.id,
  ]);
  if (deleted.length === 0) return NOT_FOUND;
  await purgeOrphanImports(items.map((i) => i.attachment_id));
  refresh();
  return { ok: true };
}

export async function addLinkToFolder(space: Space, folderId: string, rawUrl: string, rawTitle: string): Promise<FolderResult> {
  const me = await getActor(space);
  if (!(await ownsFolder(folderId, me.id))) return NOT_FOUND;
  const url = normalizeUrl(rawUrl);
  if (!url) return { ok: false, error: "Adresse invalide. Exemple : https://monsite.com" };
  const title = rawTitle.trim().slice(0, 120) || null;
  const inserted = await query(
    `INSERT INTO resource_folder_items (folder_id, link_url, link_title, added_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (folder_id, link_url) WHERE link_url IS NOT NULL DO NOTHING
     RETURNING 1`,
    [folderId, url, title, me.id],
  );
  if (inserted.length === 0) return { ok: false, error: "Ce lien est déjà dans le dossier." };
  await query("UPDATE resource_folders SET updated_at = now() WHERE id = $1", [folderId]);
  refresh();
  return { ok: true };
}

/**
 * Ajoute au dossier des ressources déjà partagées dans les discussions du compte :
 * des fichiers (par identifiant) et des liens (adresse + message d'origine).
 */
export async function addSharedToFolder(
  space: Space,
  folderId: string,
  attachmentIds: string[],
  links: { url: string; messageId: string }[],
): Promise<FolderResult> {
  const me = await getActor(space);
  if (!(await ownsFolder(folderId, me.id))) return NOT_FOUND;
  const ids = [...new Set(attachmentIds)].filter(isUuid).slice(0, 200);
  const cleanLinks = links
    .map((l) => ({ url: normalizeUrl(l.url), messageId: isUuid(l.messageId) ? l.messageId : null }))
    .filter((l): l is { url: string; messageId: string } => !!l.url && !!l.messageId)
    .slice(0, 200);
  if (ids.length === 0 && cleanLinks.length === 0) return { ok: false, error: "Sélectionnez au moins un élément." };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Fichiers : seulement ceux d'une discussion dont le compte est membre, message non supprimé.
    await client.query(
      `INSERT INTO resource_folder_items (folder_id, attachment_id, added_by)
       SELECT $1, a.id, $3 FROM attachments a
         JOIN messages m ON m.id = a.message_id AND m.deleted_at IS NULL
         JOIN conversation_members cm ON cm.conversation_id = a.conversation_id AND cm.user_id = $3
        WHERE a.id = ANY($2::uuid[])
       ON CONFLICT (folder_id, attachment_id) WHERE attachment_id IS NOT NULL DO NOTHING`,
      [folderId, ids, me.id],
    );
    // Liens : le message d'origine doit appartenir à une discussion du compte.
    for (const link of cleanLinks) {
      await client.query(
        `INSERT INTO resource_folder_items (folder_id, link_url, source_message_id, added_by)
         SELECT $1, $2, m.id, $4 FROM messages m
           JOIN conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = $4
          WHERE m.id = $3 AND m.deleted_at IS NULL
         ON CONFLICT (folder_id, link_url) WHERE link_url IS NOT NULL DO NOTHING`,
        [folderId, link.url, link.messageId, me.id],
      );
    }
    await client.query("UPDATE resource_folders SET updated_at = now() WHERE id = $1", [folderId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    return { ok: false, error: err instanceof Error ? err.message : "Ajout impossible." };
  } finally {
    client.release();
  }
  refresh();
  return { ok: true };
}

/** Retire un élément d'un de ses dossiers (un fichier importé directement est alors supprimé). */
export async function removeFolderItem(space: Space, itemId: string): Promise<FolderResult> {
  if (!isUuid(itemId)) return { ok: false, error: "Élément invalide." };
  const me = await getActor(space);
  const [removed] = await query<{ attachment_id: string | null; folder_id: string }>(
    `DELETE FROM resource_folder_items i USING resource_folders f
      WHERE i.id = $1 AND f.id = i.folder_id AND f.created_by = $2
      RETURNING i.attachment_id, i.folder_id`,
    [itemId, me.id],
  );
  if (!removed) return { ok: false, error: "Élément introuvable." };
  if (removed.attachment_id) await purgeOrphanImports([removed.attachment_id]);
  await query("UPDATE resource_folders SET updated_at = now() WHERE id = $1", [removed.folder_id]);
  refresh();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Accès aux éléments des dossiers (admin uniquement)                  */
/* ------------------------------------------------------------------ */

/** L'élément est dans un dossier de cet admin. */
async function adminOwnsItem(itemId: string, adminId: string) {
  const rows = await query(
    `SELECT 1 FROM resource_folder_items i JOIN resource_folders f ON f.id = i.folder_id
      WHERE i.id = $1 AND f.created_by = $2`,
    [itemId, adminId],
  );
  return rows.length > 0;
}

/** Donne l'accès à un élément de dossier (fichier ou lien) à des utilisateurs. */
export async function grantItemAccess(itemId: string, userIds: string[]): Promise<FolderResult> {
  if (!isUuid(itemId)) return { ok: false, error: "Élément invalide." };
  const admin = await requireAdmin();
  const ids = [...new Set(userIds)].filter(isUuid).slice(0, 200);
  if (ids.length === 0) return { ok: false, error: "Sélectionnez au moins une personne." };
  if (!(await adminOwnsItem(itemId, admin.id))) return { ok: false, error: "Élément introuvable." };

  // Seuls des utilisateurs existants (hors admin) peuvent recevoir l'accès.
  await query(
    `INSERT INTO resource_item_access (item_id, user_id, granted_by)
     SELECT $1, u.id, $3 FROM users u WHERE u.id = ANY($2::uuid[]) AND u.role <> 'admin'
     ON CONFLICT (item_id, user_id) DO NOTHING`,
    [itemId, ids, admin.id],
  );
  refresh();
  revalidatePath("/user", "layout"); // notification « partagé avec vous »
  return { ok: true };
}

/** Retire l'accès d'un utilisateur à un élément de dossier. */
export async function revokeItemAccess(itemId: string, userId: string): Promise<FolderResult> {
  if (!isUuid(itemId) || !isUuid(userId)) return { ok: false, error: "Paramètres invalides." };
  const admin = await requireAdmin();
  if (!(await adminOwnsItem(itemId, admin.id))) return { ok: false, error: "Élément introuvable." };
  await query("DELETE FROM resource_item_access WHERE item_id = $1 AND user_id = $2", [itemId, userId]);
  refresh();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Accès de l'administration aux ressources d'un utilisateur           */
/* ------------------------------------------------------------------ */

/**
 * L'utilisateur autorise (`allow`) ou non l'administration à voir un élément de ses dossiers.
 * Par défaut, tout ce qu'il importe reste privé.
 */
export async function setAdminAccess(itemId: string, allow: boolean): Promise<FolderResult> {
  if (!isUuid(itemId)) return { ok: false, error: "Élément invalide." };
  const [me, admin] = await Promise.all([requireMember(), requireAdmin()]);
  const owned = await query(
    `SELECT 1 FROM resource_folder_items i JOIN resource_folders f ON f.id = i.folder_id
      WHERE i.id = $1 AND f.created_by = $2`,
    [itemId, me.id],
  );
  if (owned.length === 0) return { ok: false, error: "Élément introuvable." };

  if (allow) {
    await query(
      `INSERT INTO resource_item_access (item_id, user_id, granted_by) VALUES ($1, $2, $3)
       ON CONFLICT (item_id, user_id) DO NOTHING`,
      [itemId, admin.id, me.id],
    );
  } else {
    await query("DELETE FROM resource_item_access WHERE item_id = $1 AND user_id = $2", [itemId, admin.id]);
  }
  refresh();
  revalidatePath("/admin", "layout"); // « Partagés avec vous » et notification côté admin
  return { ok: true };
}
