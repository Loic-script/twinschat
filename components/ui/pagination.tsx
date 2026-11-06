import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Pagination par liens (fonctionne sans JavaScript). */
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-5 sm:flex-row"
    >
      <p className="text-sm text-muted">
        Affichage {from}–{to} sur {total}
      </p>
      <div className="flex items-center gap-1.5">
        <PageLink href={hrefFor(page - 1)} disabled={page <= 1} label="Page précédente">
          <ChevronLeft className="size-4" />
        </PageLink>
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
          <PageLink key={n} href={hrefFor(n)} active={n === page} label={`Page ${n}`}>
            {n}
          </PageLink>
        ))}
        <PageLink href={hrefFor(page + 1)} disabled={page >= pageCount} label="Page suivante">
          <ChevronRight className="size-4" />
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  href,
  active,
  disabled,
  label,
  children,
}: {
  href: string;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const base = "inline-flex size-10 items-center justify-center rounded-xl text-sm font-medium";
  if (disabled) {
    return (
      <span aria-disabled className={`${base} bg-surface-2/30 text-muted/40`} aria-label={label}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`${base} ${
        active ? "bg-accent text-background" : "bg-surface-2/50 text-muted hover:bg-surface-2 hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
