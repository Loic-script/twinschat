"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool, query } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ensureDirectConversation, isUuid } from "@/lib/messages";

export type DeleteUserResult = { ok: true } | { ok: false; error: string };
export type ProjectActionResult = DeleteUserResult;

/** Rafraîchit toutes les pages admin (annuaire, profils, projets, notifications). */
function revalidateUsers() {
  revalidatePath("/admin", "layout");
}

async function runProjectUpdate(sql: string, params: unknown[]): Promise<ProjectActionResult> {
  if (!isUuid(params[0])) return { ok: false, error: "Projet invalide." };
  await requireAdmin();
  try {
    const { rowCount } = await pool.query(sql, params);
    if (!rowCount) return { ok: false, error: "Projet introuvable." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Action impossible." };
  }
  revalidateUsers();
  return { ok: true };
}

/** Marque un projet comme terminé, ou le rouvre (retour « en cours »). */
export async function setProjectCompleted(projectId: string, done: boolean) {
  return runProjectUpdate(
    done
      ? "UPDATE projects SET status = 'termine', completed_at = now() WHERE id = $1"
      : "UPDATE projects SET status = 'en_cours', completed_at = NULL WHERE id = $1",
    [projectId],
  );
}

/** Marque un projet comme payé (date du jour), ou annule le paiement. */
export async function setProjectPaid(projectId: string, paid: boolean) {
  return runProjectUpdate(
    paid
      ? "UPDATE projects SET paid_at = now() WHERE id = $1"
      : "UPDATE projects SET paid_at = NULL WHERE id = $1",
    [projectId],
  );
}

/** Associe un lien (http/https) au projet, ou le retire si la valeur est vide. */
export async function setProjectUrl(projectId: string, rawUrl: string) {
  const value = rawUrl.trim();
  let url: string | null = null;
  if (value) {
    try {
      const parsed = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
      url = parsed.toString();
    } catch {
      return { ok: false as const, error: "Adresse invalide. Exemple : https://monsite.com" };
    }
    if (url.length > 2048) return { ok: false as const, error: "Adresse trop longue." };
  }
  return runProjectUpdate("UPDATE projects SET url = $2 WHERE id = $1", [projectId, url]);
}

export async function deleteProject(projectId: string) {
  return runProjectUpdate("DELETE FROM projects WHERE id = $1", [projectId]);
}

/**
 * Supprime définitivement un utilisateur (jamais un admin) avec ses projets,
 * ses messages et ses discussions directes.
 */
export async function deleteUser(userId: string): Promise<DeleteUserResult> {
  if (!isUuid(userId)) return { ok: false, error: "Utilisateur invalide." };
  await requireAdmin();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rowCount } = await client.query(
      "SELECT 1 FROM users WHERE id = $1 AND role <> 'admin' FOR UPDATE",
      [userId],
    );
    if (!rowCount) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Utilisateur introuvable ou déjà supprimé." };
    }
    // Les discussions directes n'ont plus de sens sans cette personne.
    await client.query(
      `DELETE FROM conversations c
        WHERE c.kind = 'direct'
          AND EXISTS (SELECT 1 FROM conversation_members m
                       WHERE m.conversation_id = c.id AND m.user_id = $1)`,
      [userId],
    );
    // Projets, adhésions et messages restants partent en cascade.
    await client.query("DELETE FROM users WHERE id = $1", [userId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    return { ok: false, error: err instanceof Error ? err.message : "Suppression impossible." };
  } finally {
    client.release();
  }

  revalidatePath("/admin/utilisateurs");
  revalidatePath("/admin/messages");
  return { ok: true };
}

/** Ouvre la discussion directe avec un utilisateur, en la créant si besoin. */
export async function startConversation(userId: string) {
  if (!isUuid(userId)) throw new Error("Utilisateur invalide.");
  const admin = await requireAdmin();

  const [target] = await query("SELECT id FROM users WHERE id = $1 AND role <> 'admin'", [userId]);
  if (!target) throw new Error("Utilisateur introuvable.");
  // Même création que depuis l'espace utilisateur (verrou commun : jamais deux discussions).
  const conversationId = await ensureDirectConversation(userId, admin.id);

  redirect(`/admin/messages?c=${conversationId}`);
}
