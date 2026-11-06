import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ProjectIcon } from "@/components/brand/project-icon";
import { HashFlash } from "@/components/espace/hash-flash";
import { MyProjectCard } from "@/components/espace/my-project-card";
import { NewProjectButton } from "@/components/espace/new-project-button";
import { ProjectStats, type StatFilter } from "@/components/projects/project-stats";
import { requireMember } from "@/lib/auth";
import { listMemberProjects, projectStats } from "@/lib/projects";

export const metadata: Metadata = { title: "Mes projets" };

const FILTERS: { value: StatFilter | null; label: string }[] = [
  { value: null, label: "Tous" },
  { value: "propose", label: "Proposés" },
  { value: "en_cours", label: "En cours" },
  { value: "termine", label: "Terminés" },
  { value: "paye", label: "Payés" },
];

const isStatus = (v: unknown): v is StatFilter =>
  v === "propose" || v === "en_cours" || v === "termine" || v === "paye";
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Projets de l'utilisateur : proposition, liste, statuts et informations. */
export default async function MemberProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string | string[]; nouveau?: string | string[] }>;
}) {
  const me = await requireMember();
  const sp = await searchParams;
  const statusParam = first(sp.statut);
  const status = isStatus(statusParam) ? statusParam : null;

  const projects = await listMemberProjects(me.id);
  const stats = projectStats(projects);
  const visible = !status
    ? projects
    : status === "paye"
      ? projects.filter((p) => p.paidAt)
      : projects.filter((p) => p.status === status);

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <HashFlash />
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">Mes projets</h1>
            <p className="mt-1 text-sm text-muted">Proposez vos projets à l&apos;équipe Twins Dev et suivez leur avancement.</p>
          </div>
          <NewProjectButton autoOpen={first(sp.nouveau) === "1"} />
        </header>

        {/* Chiffres clés (chaque carte filtre la liste) */}
        <div className="mt-6">
          <ProjectStats stats={stats} active={status} basePath="/user/projets" totalLabel="Mes projets" />
        </div>

        {/* Filtre par statut */}
        <nav aria-label="Filtrer par statut" className="scroll-thin mt-8 flex gap-1 overflow-x-auto rounded-2xl bg-surface-2/50 p-1.5 sm:w-fit">
          {FILTERS.map((f) => {
            const active = f.value === status;
            const n = f.value ? stats[f.value] : stats.total;
            return (
              <Link
                key={f.label}
                href={f.value ? `/user/projets?statut=${f.value}` : "/user/projets"}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-xl px-4 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors ${
                  active ? "bg-accent text-background shadow-md shadow-accent/20" : "text-muted hover:text-foreground"
                }`}
              >
                {f.label} <span className={active ? "text-background/70" : "text-muted/70"}>{n}</span>
              </Link>
            );
          })}
        </nav>

        {visible.length > 0 ? (
          <ul className="mt-6 grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {visible.map((p) => (
              <li key={p.id}>
                <MyProjectCard project={p} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-[24px] border border-dashed border-border px-6 py-16 text-center">
            <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-accent text-background">
              <ProjectIcon className="size-7" strokeWidth={1.6} />
            </span>
            <p className="text-sm font-medium">
              {projects.length === 0 ? "Vous n'avez pas encore proposé de projet" : "Aucun projet avec ce statut"}
            </p>
            <p className="max-w-sm text-sm text-muted">
              {projects.length === 0
                ? "Décrivez votre besoin : l'équipe l'étudie et vous répond dans la discussion du projet."
                : "Changez de filtre pour retrouver vos autres projets."}
            </p>
            {projects.length === 0 && (
              <Link
                href="/user/projets?nouveau=1"
                scroll={false}
                className="mt-1 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background hover:bg-accent-strong"
              >
                <Plus className="size-4" /> Proposer un projet
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
