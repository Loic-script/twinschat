"use server";

import { getActor } from "@/lib/auth";
import { query } from "@/lib/db";
import { PROJECT_STATUS_LABELS } from "@/lib/format";
import { formatLanguages } from "@/lib/languages";
import { isMember, isUuid } from "@/lib/messages";
import { ASSISTANT_SYSTEM } from "@/lib/assistant-prompt";
import { mistralChat, MistralError } from "@/lib/mistral";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import type { ProjectStatus } from "@/lib/types";

export type DraftResult = { ok: true; draft: string } | { ok: false; error: string };

/** Messages récents donnés à Mistral, et longueur maximale de chacun. */
const HISTORY = 25;
const MAX_BODY = 1500;
const clip = (s: string, n = MAX_BODY) => (s.length > n ? `${s.slice(0, n)}…` : s);

type ProjectRow = {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  status: ProjectStatus;
  paid: boolean;
};

/**
 * Propose une réponse (brouillon, jamais envoyé automatiquement) au message `messageId`, rédigée par Mistral
 * à partir du contexte de l'application, de la fiche de la personne, de ses projets et de la discussion.
 * Réservé à l'administration. Par discrétion, ni e-mail, ni téléphone, ni adresse ne sont envoyés à Mistral.
 */
export async function draftReplyWithMistral(conversationId: string, messageId: string): Promise<DraftResult> {
  if (!isUuid(conversationId) || !isUuid(messageId)) return { ok: false, error: "Message introuvable." };
  const me = await getActor("admin");
  if (!(await isMember(me.id, conversationId))) return { ok: false, error: "Conversation introuvable." };
  const limited = rateLimit(`assistant:${me.id}`, LIMITS.assistant);
  if (!limited.ok) return { ok: false, error: `Trop de demandes à Mistral : patientez ${limited.retryAfterSec} s.` };

  const [target] = await query<{ body: string; sender_id: string }>(
    `SELECT body, sender_id FROM messages
      WHERE id = $1 AND conversation_id = $2 AND deleted_at IS NULL AND sender_id <> $3`,
    [messageId, conversationId, me.id],
  );
  if (!target) return { ok: false, error: "Message introuvable." };
  if (!target.body.trim()) return { ok: false, error: "Ce message ne contient pas de texte." };

  const [[person], [conversation], projects, history] = await Promise.all([
    query<{
      full_name: string;
      role: string;
      company: string | null;
      job_title: string | null;
      workplace: string | null;
      city: string | null;
      country: string | null;
      languages: string[] | null;
      description: string | null;
      created_at: Date;
    }>(
      `SELECT full_name, role, company, job_title, workplace, city, country, languages, description, created_at
         FROM users WHERE id = $1`,
      [target.sender_id],
    ),
    query<{ project_id: string | null }>("SELECT project_id FROM conversations WHERE id = $1", [conversationId]),
    query<ProjectRow>(
      `SELECT id, title, category, description, status, paid_at IS NOT NULL AS paid
         FROM projects WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [target.sender_id],
    ),
    query<{ body: string; sender_name: string; is_admin: boolean; files: number; created_at: Date }>(
      `SELECT m.body, u.full_name AS sender_name, u.role = 'admin' AS is_admin, m.created_at,
              (SELECT count(*)::int FROM attachments a WHERE a.message_id = m.id) AS files
         FROM messages m JOIN users u ON u.id = m.sender_id
        WHERE m.conversation_id = $1 AND m.deleted_at IS NULL
        ORDER BY m.created_at DESC LIMIT $2`,
      [conversationId, HISTORY],
    ),
  ]);

  // Projet de la discussion (même s'il appartient à quelqu'un d'autre, ex. participant ajouté)
  let project: ProjectRow | null = projects.find((p) => p.id === conversation?.project_id) ?? null;
  if (conversation?.project_id && !project) {
    [project = null] = await query<ProjectRow>(
      `SELECT id, title, category, description, status, paid_at IS NOT NULL AS paid FROM projects WHERE id = $1`,
      [conversation.project_id],
    );
  }

  const roleLabel: Record<string, string> = { client: "Client", entreprise: "Entreprise", utilisateur: "Utilisateur" };
  const describeProject = (p: ProjectRow) =>
    `« ${p.title} » — ${PROJECT_STATUS_LABELS[p.status]}${p.paid ? ", payé" : ""}${p.category ? `, ${p.category}` : ""}` +
    (p.description ? ` : ${clip(p.description, 400)}` : "");

  const personLines = person
    ? [
        `Nom : ${person.full_name}`,
        `Type de compte : ${roleLabel[person.role] ?? person.role}`,
        person.company && `Entreprise : ${person.company}`,
        person.job_title && `Poste : ${person.job_title}`,
        person.workplace && `Lieu de travail : ${person.workplace}`,
        (person.city || person.country) && `Localisation : ${[person.city, person.country].filter(Boolean).join(", ")}`,
        person.languages?.length ? `Langues parlées : ${formatLanguages(person.languages)}` : null,
        person.description && `Présentation : ${clip(person.description, 600)}`,
        `Inscrit depuis : ${person.created_at.toISOString().slice(0, 10)}`,
      ].filter(Boolean)
    : ["Inconnue"];

  const context = [
    "## Personne",
    ...personLines,
    "",
    "## Discussion",
    project ? `Discussion du projet ${describeProject(project)}` : "Discussion directe avec l'administration.",
    "",
    "## Projets de la personne",
    projects.length ? projects.map((p) => `- ${describeProject(p)}`).join("\n") : "Aucun projet.",
    "",
    `## Historique (${history.length} derniers messages, du plus ancien au plus récent)`,
    ...[...history]
      .reverse()
      .map(
        (m) =>
          `[${m.created_at.toISOString().slice(0, 16).replace("T", " ")}] ${m.is_admin ? "Administration" : m.sender_name} : ` +
          `${clip(m.body) || "(sans texte)"}${m.files ? ` (+${m.files} fichier${m.files > 1 ? "s" : ""})` : ""}`,
      ),
    "",
    "## Message auquel répondre",
    clip(target.body, 4000),
  ].join("\n");

  try {
    const reply = await mistralChat({ system: ASSISTANT_SYSTEM, user: context, temperature: 0.4, maxTokens: 700, timeoutMs: 45_000 });
    // Nettoyage : bloc de code ou guillemets autour de la réponse, longueur maximale d'un message
    const draft = reply
      .trim()
      .replace(/^```[a-z]*\n?|```$/g, "")
      .replace(/^["«]\s*|\s*["»]$/g, "")
      .trim()
      .slice(0, 4000);
    return draft ? { ok: true, draft } : { ok: false, error: "Mistral n'a pas proposé de réponse." };
  } catch (err) {
    if (err instanceof MistralError) return { ok: false, error: err.message };
    console.error("[assistant]", err);
    return { ok: false, error: "La rédaction avec Mistral a échoué." };
  }
}
