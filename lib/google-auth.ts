import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { query } from "./db";
import type { Role } from "./types";

/*
 * Connexion avec Google (OAuth 2.0 / OpenID Connect, flux « code » + PKCE) :
 * 1. /api/auth/google envoie vers Google avec un `state` et un défi PKCE gardés en cookies httpOnly ;
 * 2. Google revient sur /api/auth/google/callback avec un code ;
 * 3. le serveur échange ce code contre l'identité (id_token), retrouve ou crée le compte, ouvre la session.
 * Identifiants à créer dans Google Cloud Console : GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET (.env.local).
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

export const GOOGLE_STATE_COOKIE = "tc_google_state";
export const GOOGLE_VERIFIER_COOKIE = "tc_google_verifier";
export const GOOGLE_COOKIE_PATH = "/api/auth/google";

export type GoogleConfig = { clientId: string; clientSecret: string; redirectUri: string };

/** Configuration lue dans l'environnement, ou `null` si la connexion Google n'est pas configurée. */
export function googleConfig(origin: string): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  // Doit correspondre exactement à une « URI de redirection autorisée » déclarée chez Google.
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || `${origin}/api/auth/google/callback`;
  return { clientId, clientSecret, redirectUri };
}

/** Adresse de la page de choix de compte Google, avec le `state` et le vérificateur PKCE à garder. */
export function startGoogleAuth(config: GoogleConfig) {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { url: url.toString(), state, verifier };
}

export type GoogleProfile = { sub: string; email: string; name: string | null };

/** Échange le code reçu contre l'identité Google (adresse vérifiée obligatoire). */
export async function fetchGoogleProfile(config: GoogleConfig, code: string, verifier: string): Promise<GoogleProfile> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google a refusé l'échange du code (${res.status}).`);
  const { id_token: idToken } = (await res.json()) as { id_token?: string };
  if (!idToken) throw new Error("Réponse de Google sans id_token.");

  // Jeton reçu directement de Google, serveur à serveur et en HTTPS : on contrôle ses champs
  // (OpenID Connect Core § 3.1.3.7 : la vérification de signature n'est alors pas exigée).
  const payload = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")) as Record<string, unknown>;
  if (payload.aud !== config.clientId) throw new Error("id_token destiné à une autre application.");
  if (typeof payload.iss !== "string" || !ISSUERS.has(payload.iss)) throw new Error("id_token d'un émetteur inconnu.");
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) throw new Error("id_token expiré.");
  if (typeof payload.sub !== "string" || typeof payload.email !== "string") throw new Error("id_token incomplet.");
  if (payload.email_verified !== true) throw new Error("Adresse Google non vérifiée.");

  return {
    sub: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : null,
  };
}

/**
 * Compte TwinsChat correspondant à ce compte Google :
 * déjà lié → ce compte ; même adresse e-mail → on le lie ; sinon → nouveau compte utilisateur.
 */
export async function findOrCreateGoogleUser(profile: GoogleProfile): Promise<{ id: string; role: Role }> {
  const [linked] = await query<{ id: string; role: Role }>("SELECT id, role FROM users WHERE google_sub = $1", [profile.sub]);
  if (linked) return linked;

  const [byEmail] = await query<{ id: string; role: Role; google_sub: string | null }>(
    "SELECT id, role, google_sub FROM users WHERE lower(email) = $1",
    [profile.email],
  );
  if (byEmail) {
    if (byEmail.google_sub && byEmail.google_sub !== profile.sub) {
      throw new Error("Cette adresse est déjà liée à un autre compte Google.");
    }
    await query("UPDATE users SET google_sub = $2 WHERE id = $1", [byEmail.id, profile.sub]);
    return { id: byEmail.id, role: byEmail.role };
  }

  const [created] = await query<{ id: string; role: Role }>(
    `INSERT INTO users (full_name, email, role, google_sub)
     VALUES ($1, $2, 'utilisateur', $3)
     ON CONFLICT (email) DO NOTHING
     RETURNING id, role`,
    [profile.name ?? profile.email.split("@")[0], profile.email, profile.sub],
  );
  if (!created) throw new Error("Création du compte Google impossible.");
  return created;
}
