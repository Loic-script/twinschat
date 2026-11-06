"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/auth";
import { query } from "@/lib/db";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";

export type PasswordField = "current" | "next" | "confirm";

export type PasswordState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Partial<Record<PasswordField, string>>;
};

/**
 * Change le mot de passe du compte de l'espace (champ caché `space` : admin ou user).
 * Le mot de passe actuel est exigé s'il en existe un.
 */
export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const space = formData.get("space");
  const me = await getActor(space);
  // Pas de trim : les espaces font partie du mot de passe.
  const read = (f: PasswordField) => {
    const v = formData.get(f);
    return typeof v === "string" ? v : "";
  };
  const current = read("current");
  const next = read("next");
  const confirm = read("confirm");

  const [row] = await query<{ password_hash: string | null }>("SELECT password_hash FROM users WHERE id = $1", [
    me.id,
  ]);
  const errors: Partial<Record<PasswordField, string>> = {};

  if (row?.password_hash) {
    if (!current) errors.current = "Saisissez votre mot de passe actuel.";
    else if (!(await verifyPassword(current, row.password_hash))) errors.current = "Mot de passe actuel incorrect.";
  }
  const problem = passwordProblem(next);
  if (problem) errors.next = problem;
  else if (row?.password_hash && current === next) errors.next = "Le nouveau mot de passe doit être différent de l'actuel.";
  if (!errors.next && confirm !== next) errors.confirm = "Les deux mots de passe ne correspondent pas.";

  if (Object.keys(errors).length > 0) return { status: "error", message: "Mot de passe non modifié.", errors };

  await query("UPDATE users SET password_hash = $2 WHERE id = $1", [me.id, await hashPassword(next)]);
  revalidatePath(space === "admin" ? "/admin/profil" : "/user/profil");
  return {
    status: "success",
    message: row?.password_hash ? "Mot de passe modifié." : "Mot de passe défini.",
  };
}
