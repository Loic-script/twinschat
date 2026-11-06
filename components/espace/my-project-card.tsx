import Link from "next/link";
import { Banknote, MessagesSquare } from "lucide-react";
import { ProjectStatusBadge } from "@/components/users/project-status-badge";
import type { MemberProject } from "@/lib/projects";
import { ProjectFacts, ProjectProgress } from "./project-info";

/**
 * Carte d'un projet de l'utilisateur : statut, avancement, informations et accès à sa discussion.
 * Ancre `#projet-<id>` (liens des notifications), mise en évidence par HashFlash.
 */
export function MyProjectCard({ project }: { project: MemberProject }) {
  return (
    <article
      id={`projet-${project.id}`}
      className="flex h-full scroll-mt-6 flex-col rounded-[24px] border border-border/60 bg-surface-2/35 p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <ProjectStatusBadge status={project.status} size="md" />
        {project.category && (
          <span className="max-w-[60%] truncate rounded-full border border-border bg-surface-2/40 px-2.5 py-1 text-xs text-foreground/75">
            {project.category}
          </span>
        )}
        {project.paidAt && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-accent-strong">
            <Banknote className="size-3.5" /> Payé
          </span>
        )}
      </div>

      <h2 className="mt-3 text-lg leading-snug font-semibold">{project.title}</h2>
      {project.description && (
        <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed whitespace-pre-line text-muted">{project.description}</p>
      )}

      <div className="mt-5">
        <ProjectProgress status={project.status} />
      </div>

      <div className="mt-5 border-t border-border/50 pt-4">
        <ProjectFacts project={project} />
      </div>

      <div className="mt-auto pt-5">
        <Link
          href={`/user/messages?p=${project.id}`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:border-accent/50 hover:bg-surface-2 hover:text-accent-strong"
        >
          <MessagesSquare className="size-4" /> Discuter du projet
          {project.unread > 0 && (
            <span
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-background"
              aria-label={`${project.unread} non lu${project.unread > 1 ? "s" : ""}`}
            >
              {project.unread}
            </span>
          )}
        </Link>
      </div>
    </article>
  );
}
