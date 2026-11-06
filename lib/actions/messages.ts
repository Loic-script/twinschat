"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/auth";
import { pool, query } from "@/lib/db";
import { isMember, isUuid } from "@/lib/messages";
import { REACTION_EMOJIS, type Space } from "@/lib/types";

/*
 * Actions des discussions, communes à l'espace admin et à l'espace utilisateur.
 * `space` : espace de la page qui appelle ; l'auteur est le compte de cet espace,
 * qui doit être membre de la discussion.
 */

const MAX_LENGTH = 4000;

export type ActionResult = { ok: true } | { ok: false; error: string };

const NOT_FOUND: ActionResult = { ok: false, error: "Conversation introuvable." };

/** Les deux espaces affichent les mêmes discussions (compteurs, notifications). */
function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/user", "layout");
}

/**
 * Envoie un message. `attachmentIds` : fichiers déjà déposés via POST /api/fichiers,
 * rattachés ici au message (un message peut ne contenir que des fichiers).
 */
export async function sendMessage(
  space: Space,
  conversationId: string,
  rawBody: string,
  attachmentIds: string[] = [],
): Promise<ActionResult> {
  const body = rawBody.trim();
  const ids = [...new Set(attachmentIds)].filter(isUuid);
  if (!body && ids.length === 0) return { ok: false, error: "Le message est vide." };
  if (body.length > MAX_LENGTH) {
    return { ok: false, error: `Le message dépasse ${MAX_LENGTH} caractères.` };
  }

  const me = await getActor(space);
  if (!(await isMember(me.id, conversationId))) return NOT_FOUND;
  // Discussion d'un projet encore « Proposé » : fermée jusqu'à la validation par l'admin.
  const [pendingProject] = await query(
    `SELECT 1 FROM conversations c JOIN projects p ON p.id = c.project_id
      WHERE c.id = $1 AND p.status = 'propose'`,
    [conversationId],
  );
  if (pendingProject) {
    return { ok: false, error: "Le projet doit être validé par l'administration avant de démarrer la discussion." };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [message] } = await client.query<{ id: string; created_at: Date }>(
      "INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1, $2, $3) RETURNING id, created_at",
      [conversationId, me.id, body],
    );
    if (ids.length > 0) {
      // Seuls les fichiers déposés par l'expéditeur dans cette discussion, et pas encore envoyés.
      const { rowCount } = await client.query(
        `UPDATE attachments SET message_id = $1
          WHERE id = ANY($2::uuid[]) AND conversation_id = $3
            AND uploaded_by = $4 AND message_id IS NULL`,
        [message.id, ids, conversationId, me.id],
      );
      if (rowCount !== ids.length) throw new Error("Certains fichiers sont introuvables. Réessayez de les joindre.");
    }
    await client.query("UPDATE conversations SET updated_at = $2 WHERE id = $1", [conversationId, message.created_at]);
    await client.query(
      "UPDATE conversation_members SET last_read_at = now() WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, me.id],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    return { ok: false, error: err instanceof Error ? err.message : "Envoi impossible." };
  } finally {
    client.release();
  }
  refresh();
  return { ok: true };
}

/** Épingle ou désépingle un message (tout membre de la discussion). */
export async function togglePin(space: Space, conversationId: string, messageId: string): Promise<ActionResult> {
  if (!isUuid(messageId)) return { ok: false, error: "Message invalide." };
  const me = await getActor(space);
  if (!(await isMember(me.id, conversationId))) return NOT_FOUND;
  try {
    await query(
      "UPDATE messages SET pinned = NOT pinned WHERE id = $1 AND conversation_id = $2 AND deleted_at IS NULL",
      [messageId, conversationId],
    );
  } catch {
    return { ok: false, error: "Action impossible." };
  }
  refresh();
  return { ok: true };
}

/**
 * Suppression logique : le message reste en base mais n'est plus affiché.
 * L'admin modère toute la discussion ; les autres comptes ne suppriment que leurs messages.
 */
export async function deleteMessage(space: Space, conversationId: string, messageId: string): Promise<ActionResult> {
  if (!isUuid(messageId)) return { ok: false, error: "Message invalide." };
  const me = await getActor(space);
  if (!(await isMember(me.id, conversationId))) return NOT_FOUND;
  const deleted = await query(
    `UPDATE messages SET deleted_at = now(), pinned = false
      WHERE id = $1 AND conversation_id = $2 AND deleted_at IS NULL
        AND ($3::bool OR sender_id = $4)
      RETURNING 1`,
    [messageId, conversationId, me.role === "admin", me.id],
  );
  if (deleted.length === 0) return { ok: false, error: "Vous ne pouvez supprimer que vos propres messages." };
  refresh();
  return { ok: true };
}

export async function markAllAsRead(space: Space): Promise<void> {
  const me = await getActor(space);
  await query("UPDATE conversation_members SET last_read_at = now() WHERE user_id = $1", [me.id]);
  refresh();
}

export async function markAsRead(space: Space, conversationId: string): Promise<void> {
  if (!isUuid(conversationId)) return;
  const me = await getActor(space);
  const updated = await query(
    `UPDATE conversation_members SET last_read_at = now()
      WHERE conversation_id = $1 AND user_id = $2
        AND EXISTS (SELECT 1 FROM messages WHERE conversation_id = $1
                     AND sender_id <> $2 AND created_at > last_read_at)
      RETURNING 1`,
    [conversationId, me.id],
  );
  if (updated.length > 0) refresh();
}

/**
 * Modifie le texte d'un de ses messages (admin comme utilisateur : seulement les siens).
 * Un message sans pièce jointe ne peut pas devenir vide.
 */
export async function editMessage(
  space: Space,
  conversationId: string,
  messageId: string,
  rawBody: string,
): Promise<ActionResult> {
  if (!isUuid(messageId)) return { ok: false, error: "Message invalide." };
  const body = rawBody.trim();
  if (body.length > MAX_LENGTH) return { ok: false, error: `Le message dépasse ${MAX_LENGTH} caractères.` };
  const me = await getActor(space);
  if (!(await isMember(me.id, conversationId))) return NOT_FOUND;
  const updated = await query(
    `UPDATE messages m SET body = $4, edited_at = now()
      WHERE m.id = $1 AND m.conversation_id = $2 AND m.sender_id = $3 AND m.deleted_at IS NULL
        AND ($4 <> '' OR EXISTS (SELECT 1 FROM attachments a WHERE a.message_id = m.id))
      RETURNING 1`,
    [messageId, conversationId, me.id, body],
  );
  if (updated.length === 0) {
    return { ok: false, error: body ? "Vous ne pouvez modifier que vos propres messages." : "Le message est vide." };
  }
  refresh();
  return { ok: true };
}

/** Ajoute ou retire sa réaction (emoji) sur un message de la discussion. */
export async function toggleReaction(
  space: Space,
  conversationId: string,
  messageId: string,
  emoji: string,
): Promise<ActionResult> {
  if (!isUuid(messageId)) return { ok: false, error: "Message invalide." };
  if (!(REACTION_EMOJIS as readonly string[]).includes(emoji)) return { ok: false, error: "Réaction invalide." };
  const me = await getActor(space);
  if (!(await isMember(me.id, conversationId))) return NOT_FOUND;
  const [message] = await query(
    "SELECT 1 FROM messages WHERE id = $1 AND conversation_id = $2 AND deleted_at IS NULL",
    [messageId, conversationId],
  );
  if (!message) return { ok: false, error: "Message introuvable." };
  const removed = await query(
    "DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3 RETURNING 1",
    [messageId, me.id, emoji],
  );
  if (removed.length === 0) {
    await query(
      `INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [messageId, me.id, emoji],
    );
  }
  refresh();
  return { ok: true };
}
