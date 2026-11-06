"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  Banknote,
  BanknoteX,
  CalendarCheck2,
  CalendarPlus,
  Check,
  ExternalLink,
  Link2,
  Loader2,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { deleteProject, setProjectCompleted, setProjectPaid, setProjectUrl } from "@/app/admin/utilisateurs/actions";
import { ProjectStatusBadge } from "@/components/users/project-status-badge";
import { formatDate } from "@/lib/format";
import type { Project } from "@/lib/types";

type Mode = "idle" | "url" | "delete";

const ghostButton =
  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-50";

/** Affiche le lien sans « https:// » et sans barre finale. */
function prettyUrl(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/**
 * Projet avec ses actions (terminer / rouvrir, lien, suppression).
 * - « card » : élément de liste (page profil) ;
 * - « drawer » : contenu du volet « Détails du projet » (page Projets).
 */
export function ProjectCard({
  project: p,
  variant = "card",
  onDeleted,
}: {
  project: Project;
  variant?: "card" | "drawer";
  onDeleted?: () => void;
}) {
  const [mode, setMode] = useState<Mode>("idle");
  const [urlDraft, setUrlDraft] = useState(p.url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const done = p.status === "termine";
  const drawer = variant === "drawer";

  function run(action: () => Promise<{ ok: boolean; error?: string }>, onSuccess?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.ok) onSuccess?.();
      else setError(res.error ?? "Action impossible.");
    });
  }

  function saveUrl(e: FormEvent) {
    e.preventDefault();
    run(() => setProjectUrl(p.id, urlDraft), () => setMode("idle"));
  }

  const Wrapper = variant === "drawer" ? "section" : "li";

  return (
    <Wrapper
      aria-label={variant === "drawer" ? `Projet : ${p.title}` : undefined}
      className={`${
        variant === "drawer"
          ? "px-6 py-5"
          : `rounded-2xl border p-5 ${done ? "border-border/50 bg-background/20" : "border-border/70 bg-background/35"}`
      } transition-colors ${pending ? "opacity-70" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {p.category && (
            <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{p.category}</p>
          )}
          <h3 className="mt-0.5 text-base font-semibold">{p.title}</h3>
        </div>
        <ProjectStatusBadge status={p.status} size="md" />
      </div>

      {p.description && <p className="mt-2 text-sm leading-relaxed text-muted">{p.description}</p>}

      {p.url && mode !== "url" && (
        <a
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex max-w-full items-center gap-2 rounded-lg border border-border/70 bg-surface-2/40 px-3 py-1.5 text-sm text-foreground/90 transition-colors hover:border-accent/50 hover:text-accent-strong"
        >
          <Link2 className="size-4 shrink-0 text-muted" />
          <span className="truncate">{prettyUrl(p.url)}</span>
          <ExternalLink className="size-3.5 shrink-0 text-muted" />
        </a>
      )}

      {/* Formulaire du lien */}
      {mode === "url" && (
        <form onSubmit={saveUrl} className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor={`url-${p.id}`} className="sr-only">
            Lien du projet
          </label>
          <input
            id={`url-${p.id}`}
            type="text"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            autoFocus
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setMode("idle")}
            placeholder="https://…"
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface-2/50 px-3 py-2 text-sm placeholder:text-muted/70 focus:border-accent/60 focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-background hover:bg-accent-strong disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Enregistrer
          </button>
          {p.url && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setProjectUrl(p.id, ""), () => { setUrlDraft(""); setMode("idle"); })}
              className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-foreground"
            >
              Retirer le lien
            </button>
          )}
          <button
            type="button"
            onClick={() => { setUrlDraft(p.url ?? ""); setMode("idle"); setError(null); }}
            aria-label="Annuler"
            className="inline-flex size-9 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      {/* Dates + actions */}
      <div
        className={`mt-4 flex gap-x-4 gap-y-2 border-t border-border/50 pt-3 ${
          drawer ? "flex-col items-stretch" : "flex-wrap items-center justify-between"
        }`}
      >
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" suppressHydrationWarning>
          <span className="inline-flex items-center gap-1.5">
            <CalendarPlus className="size-3.5" /> Proposé le {formatDate(p.createdAt)}
          </span>
          {p.completedAt && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarCheck2 className="size-3.5" /> Terminé le {formatDate(p.completedAt)}
            </span>
          )}
          {p.paidAt && (
            <span className="inline-flex items-center gap-1.5 font-medium text-accent-strong">
              <Banknote className="size-3.5" /> Payé le {formatDate(p.paidAt)}
            </span>
          )}
        </p>

        {mode === "delete" ? (
          <div className={`flex items-center gap-1.5 text-xs ${drawer ? "flex-wrap" : ""}`}>
            <span className="text-rose-300">Supprimer ce projet ?</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => deleteProject(p.id), onDeleted)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-2.5 py-1.5 font-semibold text-white hover:bg-rose-400 disabled:opacity-60"
            >
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              Supprimer
            </button>
            <button type="button" onClick={() => setMode("idle")} className={ghostButton}>
              Annuler
            </button>
          </div>
        ) : (
          <div className={drawer ? "-mx-2.5 flex flex-col items-stretch [&>button]:justify-start [&>button]:py-2.5 [&>button]:text-sm" : "flex flex-wrap items-center gap-1"}>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setProjectCompleted(p.id, !done))}
              className={ghostButton}
            >
              {done ? <RotateCcw className="size-3.5" /> : <Check className="size-3.5" />}
              {done ? "Rouvrir" : "Marquer terminé"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setProjectPaid(p.id, !p.paidAt))}
              className={ghostButton}
            >
              {p.paidAt ? <BanknoteX className="size-3.5" /> : <Banknote className="size-3.5" />}
              {p.paidAt ? "Marquer non payé" : "Marquer payé"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => { setError(null); setMode("url"); }}
              className={ghostButton}
            >
              <Link2 className="size-3.5" />
              {p.url ? "Modifier le lien" : "Ajouter un lien"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => { setError(null); setMode("delete"); }}
              className={`${ghostButton} hover:bg-rose-500/10 hover:text-rose-300`}
            >
              <Trash2 className="size-3.5" />
              Supprimer
            </button>
          </div>
        )}
      </div>
    </Wrapper>
  );
}
