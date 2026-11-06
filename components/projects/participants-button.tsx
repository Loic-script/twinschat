"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Check, Loader2, Plus, Search, UserMinus, X } from "lucide-react";
import { addProjectParticipants, removeProjectParticipant } from "@/app/admin/projets/actions";
import { headerButton } from "@/components/messages/chat-panel";
import { Avatar } from "@/components/ui/avatar";
import { displayName, ROLE_LABELS } from "@/lib/format";
import type { Participant } from "@/lib/projects";

/** Bouton « + » de l'en-tête : gérer les participants de la discussion d'un projet. */
export function ParticipantsButton({
  conversationId,
  ownerId,
  members,
  candidates,
}: {
  conversationId: string;
  ownerId: string;
  members: Participant[];
  candidates: Participant[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const q = search.trim().toLocaleLowerCase("fr");
  const visibleCandidates = useMemo(
    () =>
      candidates.filter(
        (c) => !q || [c.name, c.company ?? ""].join(" ").toLocaleLowerCase("fr").includes(q),
      ),
    [candidates, q],
  );

  function open() {
    setError(null);
    setSelected(new Set());
    setSearch("");
    dialogRef.current?.showModal();
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function add() {
    setError(null);
    startTransition(async () => {
      const res = await addProjectParticipants(conversationId, [...selected]);
      if (res.ok) setSelected(new Set());
      else setError(res.error);
    });
  }

  function remove(userId: string) {
    setError(null);
    startTransition(async () => {
      const res = await removeProjectParticipant(conversationId, userId);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="Ajouter des participants"
        title="Ajouter des participants"
        className={headerButton}
      >
        <Plus className="size-5" />
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="participants-title"
        onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}
        className="m-auto w-[min(94vw,480px)] rounded-[24px] border border-border bg-surface p-0 text-foreground shadow-2xl shadow-black/60 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <div className="flex max-h-[min(720px,85vh)] flex-col">
          <header className="flex items-center gap-2 border-b border-border/60 px-6 py-5">
            <h2 id="participants-title" className="mr-auto text-lg font-semibold">
              Participants
            </h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Fermer"
              className="inline-flex size-9 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-foreground"
            >
              <X className="size-[18px]" />
            </button>
          </header>

          <div className="scroll-thin flex-1 overflow-y-auto px-6 py-4">
            {/* Participants actuels */}
            <p className="text-xs font-medium tracking-wide text-muted uppercase">
              Dans la discussion ({members.length + 1})
            </p>
            <ul className="mt-2 space-y-1">
              <li className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm text-muted">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent text-xs font-semibold text-background">
                  Vous
                </span>
                Administrateur
              </li>
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                  <Avatar name={displayName(m)} status={m.status} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{displayName(m)}</span>
                    <span className="block text-xs text-muted">
                      {m.id === ownerId ? "Auteur du projet" : ROLE_LABELS[m.role]}
                    </span>
                  </span>
                  {m.id !== ownerId && (
                    <button
                      type="button"
                      onClick={() => remove(m.id)}
                      disabled={pending}
                      aria-label={`Retirer ${displayName(m)}`}
                      title="Retirer de la discussion"
                      className="inline-flex size-9 items-center justify-center rounded-xl text-muted hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
                    >
                      <UserMinus className="size-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {/* Ajout */}
            <p className="mt-6 text-xs font-medium tracking-wide text-muted uppercase">Ajouter des personnes</p>
            <label className="relative mt-2 block">
              <span className="sr-only">Rechercher une personne</span>
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nom ou entreprise…"
                className="w-full rounded-2xl border border-border bg-surface-2/50 py-2.5 pr-4 pl-11 text-sm placeholder:text-muted/70 focus:border-foreground/20 focus:outline-none"
              />
            </label>
            <ul className="mt-2 space-y-0.5">
              {visibleCandidates.length === 0 && (
                <li className="px-2 py-6 text-center text-sm text-muted">
                  {candidates.length === 0 ? "Tout le monde participe déjà." : "Aucune personne trouvée."}
                </li>
              )}
              {visibleCandidates.map((c) => {
                const checked = selected.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => toggle(c.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${
                        checked ? "bg-surface-2" : "hover:bg-surface-2/50"
                      }`}
                    >
                      <Avatar name={displayName(c)} status={c.status} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{displayName(c)}</span>
                        <span className="block text-xs text-muted">{ROLE_LABELS[c.role]}</span>
                      </span>
                      <span
                        aria-hidden
                        className={`inline-flex size-5 shrink-0 items-center justify-center rounded-md border ${
                          checked ? "border-accent bg-accent text-background" : "border-border"
                        }`}
                      >
                        {checked && <Check className="size-3.5" strokeWidth={3} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <footer className="border-t border-border/60 px-6 py-4">
            {error && (
              <p role="alert" className="mb-3 text-sm text-rose-300">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-surface-2"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={add}
                disabled={selected.size === 0 || pending}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Ajouter{selected.size > 0 ? ` (${selected.size})` : ""}
              </button>
            </div>
          </footer>
        </div>
      </dialog>
    </>
  );
}
