"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { query } from "@/lib/db";
import { getAdminAccount } from "@/lib/messages";
import { ensureProjectConversation } from "@/lib/projects";

export type ProjectField = "title" | "category" | "description";

export type NewProjectState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Partial<Record<ProjectField, string>>;
  /** Valeurs envoyées : React vide le formulaire après l'action, on les réaffiche. */
  values?: Record<ProjectField, string>;
  /** Projet créé, pour le mettre en évidence dans la liste. */
  projectId?: string;
};

/** Garde-fou contre les envois en rafale. */
const DAILY_LIMIT = 10;

/** Proposition d'un projet : il arrive chez l'admin avec le statut « Proposé » et sa discussion. */
export async function createProject(_prev: NewProjectState, formData: FormData): Promise<NewProjectState> {
  const me = await requireMember();
  const read = (f: ProjectField) => {
    const v = formData.get(f);
    return typeof v === "string" ? v : "";
  };
  const values = {
    title: read("title").trim().replace(/\s+/g, " "),
    category: read("category").trim().replace(/\s+/g, " "),
    description: read("description").trim(),
  };

  const errors: Partial<Record<ProjectField, string>> = {};
  if (values.title.length < 3) errors.title = "Donnez un titre à votre projet (3 caractères minimum).";
  else if (values.title.length > 120) errors.title = "120 caractères maximum.";
  if (values.category.length > 60) errors.category = "60 caractères maximum.";
  if (values.description.length < 10) errors.description = "Décrivez votre projet en quelques mots (10 caractères minimum).";
  else if (values.description.length > 2000) errors.description = "2 000 caractères maximum.";
  if (Object.keys(errors).length > 0) {
    return { status: "error", message: "Certains champs sont à corriger.", errors, values };
  }

  const [{ count }] = await query<{ count: number }>(
    "SELECT count(*)::int AS count FROM projects WHERE owner_id = $1 AND created_at > now() - interval '1 day'",
    [me.id],
  );
  if (count >= DAILY_LIMIT) {
    return { status: "error", message: "Vous avez déjà proposé beaucoup de projets aujourd'hui. Réessayez demain.", values };
  }

  const [project] = await query<{ id: string }>(
    "INSERT INTO projects (owner_id, title, category, description) VALUES ($1, $2, $3, $4) RETURNING id",
    [me.id, values.title, values.category || null, values.description],
  );
  // La discussion du projet est prête tout de suite, côté utilisateur comme côté admin.
  const admin = await getAdminAccount();
  await ensureProjectConversation(project.id, me.id, admin.id);

  revalidatePath("/user", "layout");
  revalidatePath("/admin", "layout");
  return { status: "success", message: "Projet envoyé à l'équipe Twins Dev.", projectId: project.id };
}
