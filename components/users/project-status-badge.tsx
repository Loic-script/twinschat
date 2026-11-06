import { PROJECT_STATUS_LABELS } from "@/lib/format";
import type { ProjectStatus } from "@/lib/types";

// Style sobre : contour neutre, seule une petite pastille indique le statut.
const DOT: Record<ProjectStatus, string> = {
  propose: "bg-muted",
  en_cours: "bg-amber-400",
  termine: "bg-accent",
};

export function ProjectStatusBadge({ status, size = "sm" }: { status: ProjectStatus; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface-2/40 font-medium text-foreground/85 ${
        size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]"
      }`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${DOT[status]}`} />
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}
