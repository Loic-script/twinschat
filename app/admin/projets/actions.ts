"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/messages";

export type ParticipantResult = { ok: true } | { ok: false; error: string };

/** Vérifie que la conversation est bien une discussion de projet dont l'admin fait partie. */
async function projectConversation(conversationId: string) {
  if (!isUuid(conversationId)) return null;
  const admin = await requireAdmin();
  const [conv] = await query<{ owner_id: string }>(
    `SELECT p.owner_id FROM conversations c
       JOIN projects p ON p.id = c.project_id
       JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = $2
      WHERE c.id = $1 AND c.kind = 'projet'`,
    [conversationId, admin.id],
  );
  return conv ? { admin, ownerId: conv.owner_id } : null;
}

/** Ajoute des utilisateurs à la discussion d'un projet. */
export async function addProjectParticipants(conversationId: string, userIds: string[]): Promise<ParticipantResult> {
  const ids = [...new Set(userIds)].filter(isUuid);
  if (ids.length === 0) return { ok: false, error: "Sélectionnez au moins une personne." };
  if (ids.length > 50) return { ok: false, error: "50 personnes maximum à la fois." };

  const ctx = await projectConversation(conversationId);
  if (!ctx) return { ok: false, error: "Discussion de projet introuvable." };

  // Les nouveaux participants ne voient pas l'historique comme « non lu ».
  await query(
    `INSERT INTO conversation_members (conversation_id, user_id, last_read_at)
     SELECT $1, u.id, now() FROM users u
      WHERE u.id = ANY($2::uuid[]) AND u.role <> 'admin'
     ON CONFLICT (conversation_id, user_id) DO NOTHING`,
    [conversationId, ids],
  );
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/** Retire un participant (jamais l'auteur du projet ni l'admin). */
export async function removeProjectParticipant(conversationId: string, userId: string): Promise<ParticipantResult> {
  if (!isUuid(userId)) return { ok: false, error: "Utilisateur invalide." };
  const ctx = await projectConversation(conversationId);
  if (!ctx) return { ok: false, error: "Discussion de projet introuvable." };
  if (userId === ctx.ownerId) return { ok: false, error: "L'auteur du projet ne peut pas être retiré." };

  await query("DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2", [
    conversationId,
    userId,
  ]);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/**
 * Valide un projet proposé : il passe « En cours » et sa discussion s'ouvre
 * (tant qu'un projet est « Proposé », personne ne peut y écrire).
 */
export async function validateProject(projectId: string): Promise<ParticipantResult> {
  if (!isUuid(projectId)) return { ok: false, error: "Projet invalide." };
  await requireAdmin();
  const updated = await query(
    "UPDATE projects SET status = 'en_cours' WHERE id = $1 AND status = 'propose' RETURNING 1",
    [projectId],
  );
  if (updated.length === 0) return { ok: false, error: "Ce projet n'est plus en attente de validation." };
  revalidatePath("/admin", "layout");
  revalidatePath("/user", "layout");
  return { ok: true };
}
