"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { displayName, PROJECT_STATUS_LABELS } from "@/lib/format";
import type { OwnerWithProjects } from "@/lib/projects";
import type { ProjectStatus } from "@/lib/types";

type Filter = "tous" | ProjectStatus;

const SEGMENTS: { value: Filter; label: string }[] = [
  { value: "tous", label: "Tous" },
  { value: "propose", label: "Proposés" },
  { value: "en_cours", label: "En cours" },
  { value: "termine", label: "Terminés" },
];

const DOT: Record<ProjectStatus, string> = {
  propose: "bg-muted",
  en_cours: "bg-amber-400",
  termine: "bg-accent",
};

/** Liste en accordéon : chaque personne se déplie pour montrer ses projets. */
export function ProjectList({
  owners,
  activeProjectId,
}: {
  owners: OwnerWithProjects[];
  activeProjectId: string | null;
}) {
  const activeOwnerId = owners.find((o) => o.projects.some((p) => p.id === activeProjectId))?.id;
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(activeOwnerId ? [activeOwnerId] : []));
  const [filter, setFilter] = useState<Filter>("tous");
  const [search, setSearch] = useState("");

  const q = search.trim().toLocaleLowerCase("fr");
  const visible = useMemo(
    () =>
      owners
        .map((o) => {
          const ownerMatches = !q || [o.name, o.company ?? ""].join(" ").toLocaleLowerCase("fr").includes(q);
          const projects = o.projects.filter(
            (p) =>
              (filter === "tous" || p.status === filter) &&
              (ownerMatches || [p.title, p.category ?? ""].join(" ").toLocaleLowerCase("fr").includes(q)),
          );
          return { ...o, projects };
        })
        .filter((o) => o.projects.length > 0),
    [owners, filter, q],
  );

  const totalProjects = visible.reduce((n, o) => n + o.projects.length, 0);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border/60 px-6 py-5">
        <h1 className="text-[26px] font-semibold tracking-tight">Projets</h1>
      </header>

      <div className="px-6 pt-5">
        <label className="relative block">
          <span className="sr-only">Rechercher un projet ou une personne</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Projet, personne ou entreprise…"
            className="w-full rounded-2xl border border-border bg-surface-2/50 py-3 pr-4 pl-11 text-sm placeholder:text-muted/70 focus:border-foreground/20 focus:outline-none"
          />
        </label>

        <div role="group" aria-label="Filtrer par statut" className="mt-4 grid grid-cols-4 gap-1 rounded-2xl bg-surface-2/50 p-1.5">
          {SEGMENTS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setFilter(s.value)}
              aria-pressed={filter === s.value}
              className={`truncate rounded-xl px-1 py-2.5 text-[13px] font-medium transition-colors ${
                filter === s.value ? "bg-accent text-background shadow-md shadow-accent/20" : "text-muted hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <p className="mt-5 mb-2 text-sm text-muted">
          {visible.length} personne{visible.length > 1 ? "s" : ""} · {totalProjects} projet{totalProjects > 1 ? "s" : ""}
        </p>
      </div>

      <ul className="scroll-thin flex-1 space-y-1 overflow-y-auto px-4 pb-4">
        {visible.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-muted">Aucun projet trouvé.</li>
        )}
        {visible.map((o) => {
          // Pendant une recherche, tout est déplié pour montrer les correspondances.
          const isOpen = q !== "" || expanded.has(o.id);
          const name = displayName(o);
          const panelId = `owner-projects-${o.id}`;
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => toggle(o.id)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${
                  isOpen ? "bg-surface-2/50" : "hover:bg-surface-2/40"
                }`}
              >
                <Avatar name={name} status={o.status} size="lg" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{name}</span>
                  <span className="block text-xs text-muted">
                    {o.projects.length} projet{o.projects.length > 1 ? "s" : ""}
                  </span>
                </span>
                {o.unread > 0 && (
                  <span
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-background"
                    aria-label={`${o.unread} message${o.unread > 1 ? "s" : ""} non lu${o.unread > 1 ? "s" : ""}`}
                  >
                    {o.unread}
                  </span>
                )}
                <ChevronDown
                  aria-hidden
                  className={`size-4 shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isOpen && (
                <ul id={panelId} className="mt-1 mb-2 ml-[26px] space-y-0.5 border-l border-border/70 pl-3">
                  {o.projects.map((p) => {
                    const active = p.id === activeProjectId;
                    return (
                      <li key={p.id}>
                        <Link
                          href={`/admin/projets?p=${p.id}`}
                          scroll={false}
                          aria-current={active ? "page" : undefined}
                          className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                            active
                              ? "bg-surface-2 font-medium text-foreground"
                              : "text-foreground/80 hover:bg-surface-2/50 hover:text-foreground"
                          }`}
                        >
                          <span
                            className={`size-1.5 shrink-0 rounded-full ${DOT[p.status]}`}
                            title={PROJECT_STATUS_LABELS[p.status]}
                          />
                          <span className="min-w-0 flex-1 truncate">{p.title}</span>
                          <span className="sr-only">, {PROJECT_STATUS_LABELS[p.status]}</span>
                          {p.unread > 0 && (
                            <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-background">
                              {p.unread}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
