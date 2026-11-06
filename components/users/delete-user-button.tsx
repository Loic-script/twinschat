"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Trash2, TriangleAlert } from "lucide-react";
import { deleteUser } from "@/app/admin/utilisateurs/actions";

/** Bouton corbeille + fenêtre de confirmation avant suppression définitive. */
export function DeleteUserButton({ userId, name }: { userId: string; name: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open() {
    setError(null);
    dialogRef.current?.showModal();
  }

  function close() {
    if (!pending) dialogRef.current?.close();
  }

  function confirm() {
    startTransition(async () => {
      const res = await deleteUser(userId);
      if (res.ok) dialogRef.current?.close();
      else setError(res.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label={`Supprimer ${name}`}
        title="Supprimer"
        className="relative z-10 inline-flex size-[42px] shrink-0 items-center justify-center rounded-xl border border-border bg-background/30 text-muted transition-colors hover:border-rose-400/60 hover:bg-rose-500/10 hover:text-rose-300"
      >
        <Trash2 className="size-[18px]" />
      </button>

      <dialog
        ref={dialogRef}
        onCancel={(e) => pending && e.preventDefault()}
        onClick={(e) => e.target === dialogRef.current && close()}
        aria-labelledby={`delete-title-${userId}`}
        className="m-auto w-[min(92vw,440px)] rounded-[24px] border border-border bg-surface p-0 text-foreground shadow-2xl shadow-black/60 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <div className="p-6">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-300">
            <TriangleAlert className="size-6" />
          </span>
          <h2 id={`delete-title-${userId}`} className="mt-4 text-lg font-semibold">
            Supprimer {name} ?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Son profil, ses projets, ses messages et ses discussions seront supprimés définitivement.
            Cette action est irréversible.
          </p>
          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              disabled={pending}
              autoFocus
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-surface-2 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-60"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {pending ? "Suppression…" : "Supprimer"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
