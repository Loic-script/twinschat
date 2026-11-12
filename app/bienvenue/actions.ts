"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { isLanguageCode } from "@/lib/languages";
import type { Role } from "@/lib/types";

/** Type de compte choisi à l'accueil, et rôle correspondant. */
export type AccountType = "client" | "entreprise" | "autre";
const ROLE_OF: Record<AccountType, Exclude<Role, "admin">> = {
  client: "client",
  entreprise: "entreprise",
  autre: "utilisateur",
};

export type OnboardingField = "type" | "name" | "phone" | "company" | "jobTitle" | "country" | "city" | "website";

export type OnboardingState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Partial<Record<OnboardingField, string>>;
};

const LIMITS: Record<Exclude<OnboardingField, "type">, number> = {
  name: 80,
  phone: 30,
  company: 80,
  jobTitle: 80,
  country: 80,
  city: 80,
  website: 200,
};
const PHONE_RE = /^\+?[\d\s().-]{6,}$/;

/** Site web : « exemple.com » devient « https://exemple.com » ; `null` si l'adresse n'est pas valable. */
function normalizeWebsite(input: string): string | null {
  const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  try {
    const url = new URL(withScheme);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".") || /\s/.test(input)) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

const isAccountType = (v: unknown): v is AccountType => v === "client" || v === "entreprise" || v === "autre";

/**
 * Étapes 1 et 2 du parcours d'accueil : type de compte, identité, activité.
 * Marque le parcours comme terminé (la photo, étape 3, est facultative).
 */
export async function saveOnboarding(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const me = await getSessionUser();
  if (!me) redirect("/");
  if (me.role === "admin") redirect("/admin");
  // Une seule fois : le type de compte ne se change plus ensuite.
  if (me.onboarded) redirect("/user");

  const text = (f: string) => {
    const v = formData.get(f);
    return typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  };
  const type = formData.get("type");
  const values = {
    name: text("name"),
    phone: text("phone"),
    company: text("company"),
    jobTitle: text("jobTitle"),
    country: text("country"),
    city: text("city"),
    website: text("website"),
  };
  const languages = [...new Set(formData.getAll("languages"))].filter(isLanguageCode).slice(0, 30);

  const errors: OnboardingState["errors"] = {};
  if (!isAccountType(type)) errors.type = "Choisissez le type de compte.";
  for (const [f, max] of Object.entries(LIMITS) as [keyof typeof LIMITS, number][]) {
    if (values[f].length > max) errors[f] = `${max} caractères maximum.`;
  }
  if (!errors.name && values.name.length < 2) errors.name = "Indiquez votre nom (2 caractères minimum).";
  if (!errors.phone && values.phone && !PHONE_RE.test(values.phone)) errors.phone = "Numéro de téléphone invalide.";
  if (!errors.company && type === "entreprise" && !values.company) errors.company = "Indiquez le nom de votre entreprise.";
  if (!errors.country && !values.country) errors.country = "Choisissez votre pays.";
  const website = values.website ? normalizeWebsite(values.website) : null;
  if (!errors.website && values.website && !website) errors.website = "Adresse de site invalide (ex. monsite.com).";
  if (Object.keys(errors).length > 0 || !isAccountType(type)) {
    return { status: "error", message: "Certains champs sont à corriger.", errors };
  }

  const orNull = (v: string) => v || null;
  await query(
    `UPDATE users
        SET role = $2, full_name = $3, phone = $4, company = $5, job_title = $6,
            country = $7, city = $8, languages = $9, website = $10, onboarded_at = now()
      WHERE id = $1 AND onboarded_at IS NULL`,
    [
      me.id,
      ROLE_OF[type],
      values.name,
      orNull(values.phone),
      orNull(values.company),
      orNull(values.jobTitle),
      orNull(values.country),
      orNull(values.city),
      languages,
      website,
    ],
  );
  // Pas de revalidatePath ici : il relancerait le rendu de /bienvenue avant l'étape 3 (photo).
  // Les pages /user et /admin sont rendues à chaque requête : elles verront le profil à jour.
  return { status: "success" };
}
