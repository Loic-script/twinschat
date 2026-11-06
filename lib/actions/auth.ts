"use server";

import { redirect } from "next/navigation";
import { createSession, deleteSession, homeFor } from "@/lib/auth";
import { query } from "@/lib/db";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import type { Role } from "@/lib/types";

export type AuthField = "email" | "password" | "confirm";

/** État des formulaires de connexion et d'inscription (l'e-mail saisi est conservé en cas d'erreur). */
export type AuthState = {
  email?: string;
  message?: string;
  errors?: Partial<Record<AuthField, string>>;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const read = (formData: FormData, field: string) => {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
};
// Pas de trim sur les mots de passe : les espaces en font partie.
const readEmail = (formData: FormData) => read(formData, "email").trim().toLowerCase();

/*
 * Limite les essais de mot de passe : après 8 échecs sur une même adresse,
 * la connexion est bloquée 15 minutes (en mémoire du serveur).
 */
const MAX_FAILURES = 8;
const LOCK_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; since: number }>();

function isLocked(email: string) {
  const entry = failures.get(email);
  if (!entry) return false;
  if (Date.now() - entry.since > LOCK_MS) {
    failures.delete(email);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function recordFailure(email: string) {
  const entry = failures.get(email);
  if (entry && Date.now() - entry.since <= LOCK_MS) entry.count += 1;
  else failures.set(email, { count: 1, since: Date.now() });
}

/** Nom affiché d'un nouveau compte, tiré de l'adresse (modifiable ensuite dans le profil). */
function nameFromEmail(email: string) {
  const words = email
    .split("@")[0]
    .split(/[._+-]+/)
    .map((part) => part.replace(/[^\p{L}]/gu, ""))
    .filter(Boolean)
    .map((w) => w[0].toLocaleUpperCase("fr") + w.slice(1));
  return words.join(" ") || "Nouvel utilisateur";
}

/** Connexion (admin et utilisateurs) : chacun arrive dans son espace. */
export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = readEmail(formData);
  const password = read(formData, "password");

  const errors: AuthState["errors"] = {};
  if (!email) errors.email = "Saisissez votre adresse e-mail.";
  if (!password) errors.password = "Saisissez votre mot de passe.";
  if (errors.email || errors.password) return { email, errors };

  if (isLocked(email)) {
    return { email, message: "Trop de tentatives. Réessayez dans quelques minutes." };
  }

  const [user] = await query<{ id: string; role: Role; password_hash: string | null }>(
    "SELECT id, role, password_hash FROM users WHERE lower(email) = $1",
    [email],
  );
  const valid = user?.password_hash ? await verifyPassword(password, user.password_hash) : false;
  if (!user || !valid) {
    recordFailure(email);
    // Même message dans les deux cas : on ne révèle pas si l'adresse existe.
    return { email, message: "E-mail ou mot de passe incorrect." };
  }

  failures.delete(email);
  await createSession(user.id);
  redirect(homeFor(user.role));
}

/** Inscription d'un utilisateur : compte créé, connecté, puis envoyé vers son espace. */
export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = readEmail(formData);
  const password = read(formData, "password");
  const confirm = read(formData, "confirm");

  const errors: AuthState["errors"] = {};
  if (!email) errors.email = "Saisissez votre adresse e-mail.";
  else if (email.length > 254 || !EMAIL_RE.test(email)) errors.email = "Adresse e-mail invalide.";
  const problem = passwordProblem(password);
  if (problem) errors.password = problem;
  if (!confirm) errors.confirm = "Confirmez votre mot de passe.";
  else if (confirm !== password) errors.confirm = "Les mots de passe ne correspondent pas.";
  if (Object.keys(errors).length > 0) return { email, errors };

  const taken = { email, errors: { email: "Un compte existe déjà avec cette adresse." } };
  const [existing] = await query("SELECT 1 FROM users WHERE lower(email) = $1", [email]);
  if (existing) return taken;

  const [user] = await query<{ id: string }>(
    `INSERT INTO users (full_name, email, role, password_hash)
     VALUES ($1, $2, 'utilisateur', $3)
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [nameFromEmail(email), email, await hashPassword(password)],
  );
  if (!user) return taken;

  await createSession(user.id);
  redirect("/user");
}

/** Déconnexion : retour à la page de connexion. */
export async function logout() {
  await deleteSession();
  redirect("/");
}
