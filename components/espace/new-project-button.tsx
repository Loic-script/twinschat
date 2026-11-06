"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Plus, Send, X } from "lucide-react";
import { createProject, type NewProjectState, type ProjectField } from "@/app/user/projets/actions";
import { flashElement } from "./hash-flash";

const initialState: NewProjectState = { status: "idle" };

/** Suggestions de catégories (saisie libre possible). */
const CATEGORIES = [
  "Site web",
  "Site e-commerce",
  "Application web",
  "Application mobile",
  "Design",
  "Marketing",
  "Contenu",
  "Formation",
  "Data",
  "Logistique",
  "Partenariat",
];

const inputClass = (error?: string) =>
  `w-full rounded-xl border bg-surface-2/50 px-3.5 py-2.5 text-sm placeholder:text-muted/60 focus:outline-none ${
    error ? "border-rose-400/70 focus:border-rose-300" : "border-border focus:border-foreground/25"
  }`;

/**
 * Bouton « Nouveau projet » et sa fenêtre de proposition (titre, catégorie, description).
 * `autoOpen` : fenêtre ouverte à l'arrivée (lien « Proposer un projet » depuis les messages).
 */
export function NewProjectButton({ autoOpen = false }: { autoOpen?: boolean }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(createProject, initialState);
  const [formKey, setFormKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (autoOpen && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [autoOpen]);

  // Projet envoyé : on ferme, on vide le formulaire et on montre le nouveau projet.
  useEffect(() => {
    if (state.status !== "success") return;
    dialogRef.current?.close();
    setFormKey((k) => k + 1);
    setToast(state.message ?? "Projet envoyé.");
    // La liste à jour arrive avec la réponse de l'action : la nouvelle carte est déjà affichée.
    if (state.projectId) {
      const id = `projet-${state.projectId}`;
      requestAnimationFrame(() => flashElement(id));
    }
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [state]);

  const errors = state.status === "error" ? state.errors ?? {} : {};
  const values = state.status === "error" ? state.values : undefined;

  function close() {
    dialogRef.current?.close();
  }

  const field = (name: ProjectField) => ({
    id: `project-${name}`,
    name,
    defaultValue: values?.[name],
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `project-${name}-error` : undefined,
  });

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex items-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-background shadow-lg shadow-accent/20 transition hover:bg-accent-strong"
      >
        <Plus className="size-4" /> Nouveau projet
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="new-project-title"
        onClick={(e) => e.target === dialogRef.current && close()}
        onClose={() => autoOpen && router.replace("/user/projets", { scroll: false })}
        className="m-auto w-[min(94vw,560px)] rounded-[24px] border border-border bg-surface p-0 text-foreground shadow-2xl shadow-black/60 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <form key={formKey} action={formAction} noValidate className="p-6">
          <div className="flex items-start gap-3">
            <div className="mr-auto">
              <h2 id="new-project-title" className="text-lg font-semibold">
                Proposer un projet
              </h2>
              <p className="mt-0.5 text-sm text-muted">L&apos;équipe Twins Dev l&apos;étudie et vous répond dans sa discussion.</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Fermer"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-foreground"
            >
              <X className="size-[18px]" />
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor="project-title" className="mb-1.5 block text-sm font-medium text-foreground/90">
                Titre du projet
              </label>
              <input
                {...field("title")}
                type="text"
                required
                maxLength={120}
                autoFocus
                placeholder="Ex. Refonte du site vitrine"
                className={inputClass(errors.title)}
              />
              {errors.title && (
                <p id="project-title-error" className="mt-1.5 text-xs text-rose-300">
                  {errors.title}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="project-category" className="mb-1.5 block text-sm font-medium text-foreground/90">
                Catégorie <span className="font-normal text-muted">(facultatif)</span>
              </label>
              <input
                {...field("category")}
                type="text"
                list="project-categories"
                maxLength={60}
                placeholder="Site web, application mobile, design…"
                className={inputClass(errors.category)}
              />
              <datalist id="project-categories">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              {errors.category && (
                <p id="project-category-error" className="mt-1.5 text-xs text-rose-300">
                  {errors.category}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="project-description" className="mb-1.5 block text-sm font-medium text-foreground/90">
                Description
              </label>
              <textarea
                {...field("description")}
                required
                rows={5}
                maxLength={2000}
                placeholder="Objectifs, fonctionnalités attendues, délais, budget…"
                className={`${inputClass(errors.description)} resize-y`}
              />
              {errors.description && (
                <p id="project-description-error" className="mt-1.5 text-xs text-rose-300">
                  {errors.description}
                </p>
              )}
            </div>
          </div>

          {state.status === "error" && state.message && (
            <p role="alert" className="mt-4 text-sm text-rose-300">
              {state.message}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-surface-2"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-background hover:bg-accent-strong disabled:opacity-60"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Envoyer le projet
            </button>
          </div>
        </form>
      </dialog>

      {toast && (
        <p
          role="status"
          className="fixed right-4 bottom-[84px] z-50 inline-flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm shadow-2xl shadow-black/50 md:right-8 md:bottom-8"
        >
          <CheckCircle2 className="size-[18px] text-accent-strong" /> {toast}
        </p>
      )}
    </>
  );
}
