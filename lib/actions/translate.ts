"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/auth";
import { query } from "@/lib/db";
import { isLanguageCode } from "@/lib/languages";
import { isMember, isUuid } from "@/lib/messages";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { getTranslationSettings, translateTexts, TranslationError, type Translated } from "@/lib/translate";
import type { Space } from "@/lib/types";

/** Active ou désactive la traduction des messages pour le compte de l'espace (profil admin ou utilisateur). */
export async function setTranslationEnabled(space: Space, enabled: boolean): Promise<{ ok: true }> {
  const me = await getActor(space);
  await query("UPDATE users SET translation_enabled = $2 WHERE id = $1", [me.id, enabled === true]);
  // Le bouton « Traduire » des discussions suit ce réglage
  revalidatePath(space === "admin" ? "/admin" : "/user", "layout");
  return { ok: true };
}

export type MessageTranslation = { body: string; from: string | null };

/** `fallback` : le navigateur peut traduire à la place (Mistral non configuré, quota atteint…). */
export type TranslateResult =
  | { ok: true; translations: Record<string, MessageTranslation> }
  | { ok: false; error: string; fallback: boolean };

/** Messages traduits par appel (le panneau envoie les messages par paquets). */
const MAX_IDS = 40;

/**
 * Traduit avec Mistral, dans la langue `lang`, des messages reçus dans une discussion dont le compte est membre.
 * La traduction doit être activée dans son profil et la langue faire partie des siennes.
 * Les traductions sont gardées en base : un message déjà traduit et non modifié n'est pas renvoyé à Mistral.
 */
export async function translateMessages(
  space: Space,
  conversationId: string,
  messageIds: string[],
  lang: string,
): Promise<TranslateResult> {
  if (!isLanguageCode(lang)) return { ok: false, error: "Langue inconnue.", fallback: false };
  const ids = [...new Set(messageIds)].filter(isUuid).slice(0, MAX_IDS);
  if (ids.length === 0) return { ok: true, translations: {} };

  const me = await getActor(space);
  if (!(await isMember(me.id, conversationId))) {
    return { ok: false, error: "Conversation introuvable.", fallback: false };
  }
  const settings = await getTranslationSettings(me.id);
  if (!settings.enabled) {
    return { ok: false, error: "Activez d'abord la traduction dans votre profil.", fallback: false };
  }
  if (!settings.languages.includes(lang)) {
    return { ok: false, error: "Ajoutez d'abord cette langue dans votre profil.", fallback: false };
  }

  // Seulement les messages des autres, non supprimés, avec du texte, dans cette discussion
  const messages = await query<{ id: string; body: string }>(
    `SELECT id, body FROM messages
      WHERE id = ANY($1::uuid[]) AND conversation_id = $2 AND sender_id <> $3
        AND deleted_at IS NULL AND body <> ''`,
    [ids, conversationId, me.id],
  );
  if (messages.length === 0) return { ok: true, translations: {} };

  const cached = await query<{ message_id: string; source_body: string; body: string; detected_lang: string | null }>(
    `SELECT message_id, source_body, body, detected_lang FROM message_translations
      WHERE message_id = ANY($1::uuid[]) AND lang = $2`,
    [messages.map((m) => m.id), lang],
  );
  const byId = new Map(cached.map((c) => [c.message_id, c]));

  const translations: Record<string, MessageTranslation> = {};
  const missing: { id: string; body: string }[] = [];
  for (const m of messages) {
    const c = byId.get(m.id);
    // Message modifié depuis la traduction : on la refait
    if (c && c.source_body === m.body) translations[m.id] = { body: c.body, from: c.detected_lang };
    else missing.push(m);
  }

  if (missing.length > 0) {
    if (!rateLimit(`translate:${me.id}`, LIMITS.translate).ok) {
      return { ok: false, error: "Trop de traductions demandées : patientez un instant.", fallback: true };
    }
    let results: Translated[];
    try {
      results = await translateTexts(
        missing.map((m) => m.body),
        lang,
      );
    } catch (err) {
      if (err instanceof TranslationError) return { ok: false, error: err.message, fallback: err.fallback };
      console.error("[traduction]", err);
      return { ok: false, error: "La traduction a échoué.", fallback: true };
    }
    await query(
      `INSERT INTO message_translations (message_id, lang, source_body, body, detected_lang)
       SELECT * FROM unnest($1::uuid[], $2::text[], $3::text[], $4::text[], $5::text[])
       ON CONFLICT (message_id, lang) DO UPDATE
         SET source_body = EXCLUDED.source_body, body = EXCLUDED.body,
             detected_lang = EXCLUDED.detected_lang, created_at = now()`,
      [
        missing.map((m) => m.id),
        missing.map(() => lang),
        missing.map((m) => m.body),
        results.map((r) => r.body),
        results.map((r) => r.from),
      ],
    );
    missing.forEach((m, i) => (translations[m.id] = results[i]));
  }

  return { ok: true, translations };
}
