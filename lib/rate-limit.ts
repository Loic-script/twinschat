import "server-only";
import { headers } from "next/headers";

/*
 * Limiteur anti-spam : au plus `limit` actions par fenêtre glissante de `windowMs`, par clé
 * (adresse IP ou compte). Gardé en mémoire du serveur : suffisant pour une seule instance ;
 * avec plusieurs serveurs, le remplacer par un stockage partagé (Redis, PostgreSQL).
 */

const hits = new Map<string, number[]>();
let lastSweep = Date.now();

/** Nettoyage périodique des clés inactives (évite que la mémoire grossisse). */
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, times] of hits) {
    if (times.length === 0 || now - times[times.length - 1] > 60 * 60_000) hits.delete(key);
  }
}

export type RateResult = { ok: true } | { ok: false; retryAfterSec: number };

/** Enregistre une action pour `key` ; refuse si la limite est atteinte (l'action refusée n'est pas comptée). */
export function rateLimit(key: string, { limit, windowMs }: { limit: number; windowMs: number }): RateResult {
  const now = Date.now();
  sweep(now);
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true };
}

/** Adresse IP du visiteur : X-Real-IP du proxy, sinon la dernière adresse de X-Forwarded-For. */
export async function clientIp() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  return h.get("x-real-ip")?.trim() || forwarded.at(-1) || "inconnue";
}

/** Message d'attente lisible (« dans 2 minutes », « dans 30 secondes »). */
export function retryMessage(retryAfterSec: number) {
  if (retryAfterSec >= 90) return `Trop de tentatives. Réessayez dans ${Math.ceil(retryAfterSec / 60)} minutes.`;
  return `Trop de tentatives. Réessayez dans ${retryAfterSec} secondes.`;
}

/** Limites appliquées dans l'application (modifiables ici). */
export const LIMITS = {
  /** Inscriptions par adresse IP. */
  register: { limit: 5, windowMs: 60 * 60_000 },
  /** Tentatives de connexion par adresse IP (en plus du blocage par e-mail après plusieurs échecs). */
  login: { limit: 20, windowMs: 15 * 60_000 },
  /** Connexions Google lancées par adresse IP. */
  google: { limit: 20, windowMs: 10 * 60_000 },
  /** Envois de fichiers par compte (pièces jointes, imports). */
  upload: { limit: 30, windowMs: 10 * 60_000 },
  /** Messages envoyés par compte. */
  message: { limit: 20, windowMs: 60_000 },
  /** Réponses rédigées par Mistral, par compte admin. */
  assistant: { limit: 15, windowMs: 60_000 },
  /** Demandes de traduction au serveur, par compte. */
  translate: { limit: 30, windowMs: 60_000 },
} as const;

/** Délai minimum (ms) entre l'affichage du formulaire d'inscription et son envoi : un humain met plus longtemps. */
export const MIN_FORM_MS = 2500;
