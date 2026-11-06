"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { query } from "@/lib/db";
import { isLanguageCode } from "@/lib/languages";

export type MemberField =
  | "name"
  | "email"
  | "phone"
  | "company"
  | "jobTitle"
  | "workplace"
  | "city"
  | "country"
  | "address"
  | "description";

export type MemberProfileState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Partial<Record<MemberField | "languages", string>>;
  /** Valeurs envoyées : React réinitialise le formulaire après l'action, on les réaffiche. */
  values?: Record<MemberField, string>;
  languages?: string[];
};

const LIMITS: Record<MemberField, number> = {
  name: 80,
  email: 254,
  phone: 30,
  company: 80,
  jobTitle: 80,
  workplace: 120,
  city: 80,
  country: 80,
  address: 200,
  description: 1000,
};
const FIELDS = Object.keys(LIMITS) as MemberField[];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s().-]{6,}$/;

/** Enregistre les informations du profil (visibles par l'administration). */
export async function updateMemberProfile(_prev: MemberProfileState, formData: FormData): Promise<MemberProfileState> {
  const me = await requireMember();
  const read = (f: MemberField) => {
    const v = formData.get(f);
    if (typeof v !== "string") return "";
    // La présentation garde ses retours à la ligne ; les autres champs sont sur une ligne.
    return f === "description" ? v.trim() : v.trim().replace(/\s+/g, " ");
  };
  const values = Object.fromEntries(FIELDS.map((f) => [f, read(f)])) as Record<MemberField, string>;
  // Langues : codes connus uniquement, sans doublon.
  const languages = [...new Set(formData.getAll("languages"))].filter(isLanguageCode).slice(0, 30);

  const errors: Partial<Record<MemberField | "languages", string>> = {};
  for (const f of FIELDS) {
    if (values[f].length > LIMITS[f]) errors[f] = `${LIMITS[f].toLocaleString("fr-FR")} caractères maximum.`;
  }
  if (!errors.name && values.name.length < 2) errors.name = "Indiquez votre nom (2 caractères minimum).";
  if (!errors.email && !EMAIL_RE.test(values.email)) errors.email = "Adresse e-mail invalide.";
  if (!errors.phone && values.phone && !PHONE_RE.test(values.phone)) errors.phone = "Numéro de téléphone invalide.";
  if (!errors.company && me.role === "entreprise" && !values.company) {
    errors.company = "Indiquez le nom de votre entreprise.";
  }
  if (!errors.email) {
    const taken = await query("SELECT 1 FROM users WHERE lower(email) = lower($1) AND id <> $2", [values.email, me.id]);
    if (taken.length > 0) errors.email = "Cette adresse est déjà utilisée par un autre compte.";
  }
  if (Object.keys(errors).length > 0) {
    return { status: "error", message: "Certains champs sont à corriger.", errors, values, languages };
  }

  const orNull = (v: string) => v || null;
  await query(
    `UPDATE users SET full_name = $2, email = $3, phone = $4, company = $5, job_title = $6,
                      workplace = $7, city = $8, address = $9, description = $10,
                      country = $11, languages = $12
      WHERE id = $1`,
    [
      me.id,
      values.name,
      values.email.toLowerCase(),
      orNull(values.phone),
      orNull(values.company),
      orNull(values.jobTitle),
      orNull(values.workplace),
      orNull(values.city),
      orNull(values.address),
      orNull(values.description),
      orNull(values.country),
      languages,
    ],
  );
  // Le nom apparaît partout (menu, discussions) et l'admin voit le profil à jour.
  revalidatePath("/user", "layout");
  revalidatePath("/admin", "layout");
  return {
    status: "success",
    message: "Profil enregistré.",
    values: { ...values, email: values.email.toLowerCase() },
    languages,
  };
}
