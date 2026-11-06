import Link from "next/link";
import { ArrowRight, Banknote, CalendarPlus, Check, CheckCircle2, Clock3, ExternalLink, Link2 } from "lucide-react";
import { ProjectStatusBadge } from "@/components/users/project-status-badge";
import { displayName, formatDate, PROJECT_STATUS_LABELS } from "@/lib/format";
import type { ProjectWithOwner } from "@/lib/projects";
import type { Project, ProjectStatus } from "@/lib/types";

const STEPS: ProjectStatus[] = ["propose", "en_cours", "termine"];

/** Avancement du projet en trois étapes : Proposé → En cours → Terminé. */
export function ProjectProgress({ status }: { status: ProjectStatus }) {
  const current = STEPS.indexOf(status);
  return (
    <ol aria-label={`Avancement : ${PROJECT_STATUS_LABELS[status]}`} className="flex items-start">
      {STEPS.map((step, i) => {
        const reached = i <= current;
        const done = i < current || status === "termine";
        return (
          <li
            key={step}
            aria-current={i === current ? "step" : undefined}
            className={`flex items-start ${i < STEPS.length - 1 ? "flex-1" : ""}`}
          >
            <span className="flex w-16 flex-col items-center gap-1.5 text-center">
              <span
                className={`inline-flex size-7 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors ${
                  reached ? "border-accent bg-accent text-background" : "border-border bg-surface text-muted"
                }`}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={`text-[11px] leading-tight ${
                  i === current ? "font-semibold text-foreground" : reached ? "text-foreground/80" : "text-muted"
                }`}
              >
                {PROJECT_STATUS_LABELS[step]}
              </span>
            </span>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                className={`mt-3.5 h-0.5 flex-1 rounded-full ${i < current ? "bg-accent" : "bg-border"}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Dates clés, paiement et lien du projet. */
export function ProjectFacts({ project }: { project: Project }) {
  const rows = [
    { icon: CalendarPlus, label: "Proposé le", value: formatDate(project.createdAt) },
    project.completedAt
      ? { icon: CheckCircle2, label: "Terminé le", value: formatDate(project.completedAt) }
      : { icon: Clock3, label: "Fin", value: project.status === "en_cours" ? "En cours de réalisation" : "À venir" },
    project.paidAt
      ? { icon: Banknote, label: "Paiement", value: `Payé le ${formatDate(project.paidAt)}`, positive: true }
      : { icon: Banknote, label: "Paiement", value: "Non payé" },
  ];

  return (
    <dl className="grid gap-2.5 text-sm">
      {rows.map(({ icon: Icon, label, value, ...rest }) => (
        <div key={label} className="flex items-center gap-3">
          <dt className="flex w-32 shrink-0 items-center gap-2 text-muted">
            <Icon className="size-4" aria-hidden /> {label}
          </dt>
          <dd className={"positive" in rest ? "font-medium text-accent-strong" : "text-foreground/90"}>{value}</dd>
        </div>
      ))}
      {project.url && (
        <div className="flex items-center gap-3">
          <dt className="flex w-32 shrink-0 items-center gap-2 text-muted">
            <Link2 className="size-4" aria-hidden /> Lien
          </dt>
          <dd className="min-w-0">
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1.5 font-medium text-accent-strong hover:underline"
            >
              <span className="truncate">{hostOf(project.url)}</span>
              <ExternalLink className="size-3.5 shrink-0" />
            </a>
          </dd>
        </div>
      )}
    </dl>
  );
}

/** Volet « Détails du projet » de la discussion, en lecture seule (espace utilisateur). */
export function MemberProjectPanel({ project, isOwner }: { project: ProjectWithOwner; isOwner: boolean }) {
  return (
    <div className="space-y-6 px-6 py-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <ProjectStatusBadge status={project.status} size="md" />
          {project.category && (
            <span className="rounded-full border border-border bg-surface-2/40 px-2.5 py-1 text-xs text-foreground/75">
              {project.category}
            </span>
          )}
        </div>
        <h3 className="mt-3 text-xl leading-snug font-semibold">{project.title}</h3>
        <p className="mt-1 text-sm text-muted">{isOwner ? "Votre projet" : `Projet de ${displayName(project.owner)}`}</p>
      </div>

      <ProjectProgress status={project.status} />

      {project.description && (
        <section>
          <h4 className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">Description</h4>
          <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">{project.description}</p>
        </section>
      )}

      <section>
        <h4 className="mb-2.5 text-xs font-medium tracking-wide text-muted uppercase">Informations</h4>
        <ProjectFacts project={project} />
      </section>

      {isOwner && (
        <Link
          href={`/user/projets#projet-${project.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-strong hover:underline"
        >
          Voir dans Mes projets <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}
