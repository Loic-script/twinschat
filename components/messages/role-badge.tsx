import { ROLE_LABELS } from "@/lib/format";
import type { Role } from "@/lib/types";

/** Badge de type de compte : style neutre et sobre, identique pour tous les rôles. */
export function RoleBadge({ role, compact = false }: { role: Role; compact?: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full border border-border bg-surface-2/40 font-medium text-foreground/75 ${
        compact ? "px-1.5 py-px text-[10px]" : "px-2.5 py-0.5 text-[11px]"
      }`}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}
