"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

/* ------------------------------------------------------------------ */
/* Pseudo et e-mail                                                    */
/* ------------------------------------------------------------------ */

export type ProfileField = "name" | "email";

export type ProfileState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Partial<Record<ProfileField, string>>;
  /** Valeurs envoyées : React réinitialise le formulaire après l'action, on les réaffiche. */
  values?: Record<ProfileField, string>;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (formData: FormData, field: string) => {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
};

/** Enregistre le pseudo (nom affiché) et l'e-mail de l'admin. */
export async function updateAdminProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const admin = await requireAdmin();
  const values = { name: text(formData, "name").replace(/\s+/g, " "), email: text(formData, "email") };

  const errors: Partial<Record<ProfileField, string>> = {};
  if (values.name.length < 2) errors.name = "Choisissez un pseudo (2 caractères minimum).";
  else if (values.name.length > 40) errors.name = "40 caractères maximum.";
  if (!EMAIL_RE.test(values.email) || values.email.length > 254) errors.email = "Adresse e-mail invalide.";

  if (!errors.email) {
    const taken = await query("SELECT 1 FROM users WHERE lower(email) = lower($1) AND id <> $2", [
      values.email,
      admin.id,
    ]);
    if (taken.length > 0) errors.email = "Cette adresse est déjà utilisée par un autre compte.";
  }
  if (Object.keys(errors).length > 0) {
    return { status: "error", message: "Certains champs sont à corriger.", errors, values };
  }

  await query("UPDATE users SET full_name = $2, email = $3 WHERE id = $1", [
    admin.id,
    values.name,
    values.email.toLowerCase(),
  ]);
  revalidatePath("/admin", "layout");
  return { status: "success", message: "Modifications enregistrées.", values };
}
