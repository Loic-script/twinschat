"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Hourglass, Loader2 } from "lucide-react";
import { validateProject } from "@/app/admin/projets/actions";

const card =
  "flex flex-col gap-4 rounded-[22px] border border-border/60 bg-surface-2/40 p-5 sm:flex-row sm:items-center";
const iconTile = "inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2/70 text-muted";

/**
 * Admin : un projet « Proposé » doit être validé avant toute discussion.
 * La validation le passe « En cours » et ouvre la zone de saisie.
 */
export function ProjectValidation({ projectId, ownerName }: { projectId: string; ownerName: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function validate() {
    setError(null);
    startTransition(async () => {
      const res = await validateProject(projectId);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="px-4 pb-4 md:px-8 md:pb-6">
      <div className={card}>
        <span className={iconTile}>
          <Hourglass className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Projet en attente de validation</p>
          <p className="mt-0.5 text-sm text-muted">
            Validez le projet pour ouvrir la discussion avec {ownerName}. Il passera au statut « En cours ».
          </p>
          {error && (
            <p role="alert" className="mt-1.5 text-sm text-rose-300">
              {error}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={validate}
          disabled={pending}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-background shadow-lg shadow-accent/20 transition hover:bg-accent-strong disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Valider le projet
        </button>
      </div>
    </div>
  );
}

/** Utilisateur : la discussion du projet s'ouvrira dès que l'équipe l'aura validé. */
export function ProjectPendingNotice() {
  return (
    <div className="px-4 pb-4 md:px-8 md:pb-6">
      <div className={card}>
        <span className={iconTile}>
          <Hourglass className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">En attente de validation</p>
          <p className="mt-0.5 text-sm text-muted">
            L&apos;équipe Twins Dev étudie votre projet. La discussion s&apos;ouvrira dès qu&apos;il sera validé.
          </p>
        </div>
      </div>
    </div>
  );
}
