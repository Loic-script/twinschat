import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { query } from "./db";
import { avatarUrl } from "./messages";
import type { Role, Space } from "./types";

/*
 * Connexion par session en base :
 * - le cookie (httpOnly) contient un jeton aléatoire ;
 * - la table `sessions` n'en garde que l'empreinte SHA-256 (une fuite de la table ne permet pas
 *   d'usurper une session).
 * Les pages et les actions passent toutes par requireAdmin, requireMember ou getActor.
 */

const COOKIE = "tc_session";
const SESSION_DAYS = 30;

/** Compte connecté, tel qu'exposé aux pages et aux actions. */
export type Actor = {
  id: string;
  name: string;
  email: string;
  role: Role;
  company: string | null;
  avatarUrl: string | null;
  /** Parcours d'accueil terminé (faux juste après l'inscription). */
  onboarded: boolean;
};

const digest = (token: string) => createHash("sha256").update(token).digest("hex");

/** Page d'arrivée de chaque rôle après la connexion. */
export const homeFor = (role: Role) => (role === "admin" ? "/admin" : "/user");

/** Compte de la session en cours, ou `null` (pas de cookie, session expirée ou supprimée). */
export const getSessionUser = cache(async (): Promise<Actor | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await query<{
    id: string;
    full_name: string;
    email: string;
    role: Role;
    company: string | null;
    avatar_key: string | null;
    avatar_updated_at: Date | null;
    onboarded: boolean;
  }>(
    `SELECT u.id, u.full_name, u.email, u.role, u.company, u.avatar_key, u.avatar_updated_at,
            u.onboarded_at IS NOT NULL AS onboarded
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > now()`,
    [digest(token)],
  );
  if (!row) return null;
  return {
    id: row.id,
    name: row.full_name,
    email: row.email,
    role: row.role,
    company: row.company,
    avatarUrl: avatarUrl(row.id, row.avatar_key, row.avatar_updated_at),
    onboarded: row.onboarded,
  };
});

/** Ouvre une session pour ce compte (à appeler depuis une action serveur). */
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)", [digest(token), userId, expires]);
  // Ménage : les sessions expirées ne servent plus à rien.
  await query("DELETE FROM sessions WHERE expires_at <= now()");
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

/** Ferme la session en cours (déconnexion). */
export async function deleteSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await query("DELETE FROM sessions WHERE id = $1", [digest(token)]);
  store.delete(COOKIE);
}

/** Espace admin : réservé au compte administrateur (sinon retour à la connexion ou à /user). */
export const requireAdmin = cache(async (): Promise<Actor> => {
  const me = await getSessionUser();
  if (!me) redirect("/");
  if (me.role !== "admin") redirect(homeFor(me.role));
  return me;
});

/**
 * Espace utilisateur : clients, entreprises et utilisateurs (l'admin est renvoyé vers /admin).
 * Un compte qui n'a pas terminé le parcours d'accueil y est d'abord envoyé.
 */
export const requireMember = cache(async (): Promise<Actor> => {
  const me = await getSessionUser();
  if (!me) redirect("/");
  if (me.role === "admin") redirect(homeFor(me.role));
  if (!me.onboarded) redirect("/bienvenue");
  return me;
});

export const isSpace = (value: unknown): value is Space => value === "admin" || value === "user";

/**
 * Compte qui agit pour une action commune aux deux espaces (messages, fichiers, dossiers,
 * notifications, photo, mot de passe) : la session doit correspondre à l'espace appelant.
 */
export async function getActor(space: unknown): Promise<Actor> {
  if (space === "admin") return requireAdmin();
  if (space === "user") return requireMember();
  throw new Error("Espace inconnu.");
}
