"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Banknote, BanknoteX, Check, Link2, Loader2, MoreHorizontal, RotateCcw, Trash2, X } from "lucide-react";
import { deleteProject, setProjectCompleted, setProjectPaid, setProjectUrl } from "@/app/admin/utilisateurs/actions";
import type { ProjectStatus } from "@/lib/types";

type RowProject = { id: string; title: string; status: ProjectStatus; paidAt: string | null; url: string | null };

const MENU_WIDTH = 232;
const item =
  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-foreground/90 transition-colors hover:bg-surface-2 disabled:opacity-50";
const dialogClass =
  "m-auto w-[min(92vw,440px)] rounded-[24px] border border-border bg-surface p-0 text-foreground shadow-2xl shadow-black/60 backdrop:bg-black/60 backdrop:backdrop-blur-sm";

/**
 * Actions d'un projet dans une ligne de liste (bouton « … ») : terminer / rouvrir,
 * payé / non payé, lien, suppression. Les mêmes actions que la carte du projet.
 */
export function ProjectRowActions({ project: p }: { project: RowProject }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [urlDraft, setUrlDraft] = useState(p.url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const urlDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const done = p.status === "termine";

  // Fermeture du menu : clic extérieur, Échap, défilement, redimensionnement.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  function toggle() {
    if (open) return setOpen(false);
    const r = buttonRef.current?.getBoundingClientRect();
    if (!r) return;
    // Sous le bouton, aligné à droite ; au-dessus s'il n'y a pas la place en bas.
    const below = r.bottom + 8;
    const top = below + 260 > window.innerHeight ? Math.max(8, r.top - 8 - 236) : below;
    setPos({ top, left: Math.max(8, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)) });
    setOpen(true);
  }

  function run(action: () => Promise<{ ok: boolean; error?: string }>, onSuccess?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.ok) onSuccess?.();
      else setError(res.error ?? "Action impossible.");
    });
  }

  function choose(fn: () => void) {
    setOpen(false);
    fn();
  }

  function saveUrl(e: FormEvent) {
    e.preventDefault();
    run(() => setProjectUrl(p.id, urlDraft), () => urlDialog.current?.close());
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions du projet ${p.title}`}
        title="Actions"
        className={`inline-flex size-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-foreground ${
          open ? "bg-surface-2 text-foreground" : ""
        }`}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-[18px]" />}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Actions du projet ${p.title}`}
            style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
            className="fixed z-50 rounded-2xl border border-border bg-surface p-1.5 shadow-2xl shadow-black/60"
          >
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => choose(() => run(() => setProjectCompleted(p.id, !done)))}
            >
              {done ? <RotateCcw className="size-4 text-muted" /> : <Check className="size-4 text-muted" />}
              {done ? "Rouvrir" : "Marquer terminé"}
            </button>
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => choose(() => run(() => setProjectPaid(p.id, !p.paidAt)))}
            >
              {p.paidAt ? <BanknoteX className="size-4 text-muted" /> : <Banknote className="size-4 text-muted" />}
              {p.paidAt ? "Marquer non payé" : "Marquer payé"}
            </button>
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() =>
                choose(() => {
                  setError(null);
                  setUrlDraft(p.url ?? "");
                  urlDialog.current?.showModal();
                })
              }
            >
              <Link2 className="size-4 text-muted" />
              {p.url ? "Modifier le lien" : "Ajouter un lien"}
            </button>
            <div className="my-1 h-px bg-border/60" />
            <button
              type="button"
              role="menuitem"
              className={`${item} text-rose-300 hover:bg-rose-500/10`}
              onClick={() =>
                choose(() => {
                  setError(null);
                  deleteDialog.current?.showModal();
                })
              }
            >
              <Trash2 className="size-4" />
              Supprimer
            </button>
          </div>,
          document.body,
        )}

      {/* Erreur d'une action rapide (terminé, payé) */}
      {error && (
        <p role="alert" className="absolute right-4 mt-1 text-xs text-rose-300">
          {error}
        </p>
      )}

      {/* Lien du projet */}
      <dialog
        ref={urlDialog}
        aria-labelledby={`url-title-${p.id}`}
        onClick={(e) => e.target === urlDialog.current && urlDialog.current?.close()}
        className={dialogClass}
      >
        <form onSubmit={saveUrl} className="p-6">
          <div className="flex items-start gap-3">
            <div className="mr-auto min-w-0">
              <h2 id={`url-title-${p.id}`} className="text-lg font-semibold">
                {p.url ? "Modifier le lien" : "Ajouter un lien"}
              </h2>
              <p className="mt-0.5 truncate text-sm text-muted">{p.title}</p>
            </div>
            <button
              type="button"
              onClick={() => urlDialog.current?.close()}
              aria-label="Fermer"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-foreground"
            >
              <X className="size-[18px]" />
            </button>
          </div>
          <label htmlFor={`row-url-${p.id}`} className="mt-5 mb-1.5 block text-sm font-medium text-foreground/90">
            Adresse (site, maquette, dépôt…)
          </label>
          <input
            id={`row-url-${p.id}`}
            type="text"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-xl border border-border bg-surface-2/50 px-3.5 py-2.5 text-sm placeholder:text-muted/70 focus:border-accent/60 focus:outline-none"
          />
          {error && (
            <p role="alert" className="mt-2 text-sm text-rose-300">
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            {p.url && (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => setProjectUrl(p.id, ""), () => urlDialog.current?.close())}
                className="mr-auto rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-surface-2 hover:text-foreground"
              >
                Retirer le lien
              </button>
            )}
            <button
              type="button"
              onClick={() => urlDialog.current?.close()}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-surface-2"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background hover:bg-accent-strong disabled:opacity-60"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Enregistrer
            </button>
          </div>
        </form>
      </dialog>

      {/* Confirmation de suppression */}
      <dialog
        ref={deleteDialog}
        aria-labelledby={`delete-title-${p.id}`}
        onClick={(e) => e.target === deleteDialog.current && deleteDialog.current?.close()}
        className={dialogClass}
      >
        <div className="p-6">
          <h2 id={`delete-title-${p.id}`} className="text-lg font-semibold">
            Supprimer le projet
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Le projet <span className="font-semibold text-foreground">« {p.title} »</span> et sa discussion seront
            supprimés définitivement.
          </p>
          {error && (
            <p role="alert" className="mt-3 text-sm text-rose-300">
              {error}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => deleteDialog.current?.close()}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-surface-2"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => deleteProject(p.id), () => deleteDialog.current?.close())}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-60"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Supprimer
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
