import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, Search } from "lucide-react";
import { ProjectIcon } from "@/components/brand/project-icon";
import { ProjectRowActions } from "@/components/projects/project-row-actions";
import { ProjectStats, type StatFilter } from "@/components/projects/project-stats";
import { Avatar } from "@/components/ui/avatar";
import { ProjectStatusBadge } from "@/components/users/project-status-badge";
import { requireAdmin } from "@/lib/auth";
import { displayName, formatDate } from "@/lib/format";
import { listAllProjects, projectStats, type ProjectWithAuthor } from "@/lib/projects";

export const metadata: Metadata = { title: "Statistiques" };

const FILTERS: { value: StatFilter | null; label: string }[] = [
  { value: null, label: "Tous" },
  { value: "propose", label: "Proposés" },
  { value: "en_cours", label: "En cours" },
  { value: "termine", label: "Terminés" },
  { value: "paye", label: "Payés" },
];

const isFilter = (v: unknown): v is StatFilter =>
  v === "propose" || v === "en_cours" || v === "termine" || v === "paye";
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("fr");

function matches(p: ProjectWithAuthor, filter: StatFilter | null, q: string) {
  if (filter === "paye" && !p.paidAt) return false;
  if (filter && filter !== "paye" && p.status !== filter) return false;
  if (!q) return true;
  const text = [p.title, p.category ?? "", p.owner.name, p.owner.company ?? ""].join(" ");
  return normalize(text).includes(normalize(q));
}

/** Statistiques des projets : chiffres clés, puis la liste des projets filtrable. */
export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string | string[]; q?: string | string[] }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const filterParam = first(sp.statut);
  const filter = isFilter(filterParam) ? filterParam : null;
  const q = first(sp.q)?.trim() ?? "";

  const projects = await listAllProjects();
  const stats = projectStats(projects);
  const visible = projects.filter((p) => matches(p, filter, q));

  const href = (f: StatFilter | null) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (f) params.set("statut", f);
    const qs = params.toString();
    return `/admin/statistiques${qs ? `?${qs}` : ""}`;
  };
  const countFor = (f: StatFilter | null) => (f ? stats[f] : stats.total);

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <header>
          <h1 className="text-[28px] font-semibold tracking-tight">Statistiques</h1>
          <p className="mt-1 text-sm text-muted">Vue d&apos;ensemble des projets proposés sur TwinsChat.</p>
        </header>

        <div className="mt-6">
          <ProjectStats stats={stats} active={filter} basePath="/admin/statistiques" query={q ? `q=${encodeURIComponent(q)}` : ""} />
        </div>

        {/* Liste des projets */}
        <section className="mt-10" aria-labelledby="stats-projects">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 id="stats-projects" className="text-lg font-semibold">
              Projets <span className="text-sm font-normal text-muted">({visible.length})</span>
            </h2>
            <form action="/admin/statistiques" role="search" className="relative lg:w-[340px]">
              {filter && <input type="hidden" name="statut" value={filter} />}
              <label htmlFor="stats-search" className="sr-only">
                Rechercher un projet
              </label>
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
              <input
                id="stats-search"
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Projet, catégorie, personne…"
                className="w-full rounded-2xl border border-border bg-surface-2/50 py-3 pr-4 pl-11 text-sm placeholder:text-muted/70 focus:border-accent/60 focus:outline-none"
              />
            </form>
          </div>

          <nav aria-label="Filtrer par statut" className="scroll-thin mt-4 flex gap-1 overflow-x-auto rounded-2xl bg-surface-2/50 p-1.5 sm:w-fit">
            {FILTERS.map((f) => {
              const active = f.value === filter;
              return (
                <Link
                  key={f.label}
                  href={href(f.value)}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 rounded-xl px-4 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors ${
                    active ? "bg-accent text-background shadow-md shadow-accent/20" : "text-muted hover:text-foreground"
                  }`}
                >
                  {f.label} <span className={active ? "text-background/70" : "text-muted/70"}>{countFor(f.value)}</span>
                </Link>
              );
            })}
          </nav>

          {visible.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-[24px] border border-border/60 bg-surface-2/25">
              <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.5fr)_110px_120px_110px_36px] gap-4 border-b border-border/60 px-5 py-3 text-xs font-medium tracking-wide text-muted uppercase lg:grid">
                <span>Projet</span>
                <span>Proposé par</span>
                <span>Statut</span>
                <span>Proposé le</span>
                <span>Paiement</span>
                <span />
              </div>
              <ul className="divide-y divide-border/50">
                {visible.map((p) => (
                  <li key={p.id}>
                    <ProjectRow project={p} />
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-3 rounded-[24px] border border-dashed border-border px-6 py-14 text-center">
              <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-surface-2/70 text-muted">
                <ProjectIcon className="size-6" strokeWidth={1.6} />
              </span>
              <p className="text-sm text-muted">Aucun projet ne correspond à ces critères.</p>
              {(filter || q) && (
                <Link href="/admin/statistiques" scroll={false} className="text-sm font-medium text-accent-strong hover:underline">
                  Effacer les filtres
                </Link>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/** Ligne d'un projet : le titre ouvre sa discussion, le bouton « … » ses actions. */
function ProjectRow({ project: p }: { project: ProjectWithAuthor }) {
  return (
    <div className="relative grid items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-2/40 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.5fr)_110px_120px_110px_36px] lg:gap-4">
      <Link href={`/admin/projets?p=${p.id}`} className="group flex min-w-0 items-center gap-3 pr-10 lg:pr-0" title="Ouvrir la discussion du projet">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2/70 text-muted">
          <ProjectIcon className="size-5" strokeWidth={1.9} />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold group-hover:text-accent-strong group-hover:underline">{p.title}</span>
          <span className="block truncate text-xs text-muted">{p.category ?? "Sans catégorie"}</span>
        </span>
      </Link>
      <span className="flex min-w-0 items-center gap-2.5">
        <Avatar name={displayName(p.owner)} src={p.owner.avatarUrl} size="sm" />
        <span className="truncate text-sm text-foreground/85">{displayName(p.owner)}</span>
      </span>
      <span className="flex flex-wrap items-center gap-2 lg:contents">
        <span>
          <ProjectStatusBadge status={p.status} />
        </span>
        <span className="text-xs text-muted">
          <span className="lg:hidden">Proposé le </span>
          {formatDate(p.createdAt)}
        </span>
        <span>
          {p.paidAt ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-accent-strong">
              <Banknote className="size-3.5" /> Payé
            </span>
          ) : (
            <span className="text-xs text-muted/70">Non payé</span>
          )}
        </span>
      </span>
      <span className="absolute top-4 right-3 lg:static">
        <ProjectRowActions project={p} />
      </span>
    </div>
  );
}
