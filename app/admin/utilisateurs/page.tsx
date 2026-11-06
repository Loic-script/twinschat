import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { UserCard } from "@/components/users/user-card";
import { UserCountBadge } from "@/components/users/user-count-badge";
import { requireAdmin } from "@/lib/auth";
import { getRegisteredStats, isRoleFilter, listUsers, USERS_PAGE_SIZE, type UserRoleFilter } from "@/lib/users";

export const metadata: Metadata = { title: "Utilisateurs" };

const SEGMENTS: { value: UserRoleFilter | null; label: string }[] = [
  { value: null, label: "Tous" },
  { value: "client", label: "Clients" },
  { value: "entreprise", label: "Entreprises" },
  { value: "utilisateur", label: "Utilisateurs" },
];

type Search = { q?: string | string[]; role?: string | string[]; page?: string | string[] };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function hrefFor(params: { q?: string; role?: UserRoleFilter | null; page?: number }) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.role) sp.set("role", params.role);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return `/admin/utilisateurs${qs ? `?${qs}` : ""}`;
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = first(sp.q)?.trim() ?? "";
  const roleParam = first(sp.role);
  const role = isRoleFilter(roleParam) ? roleParam : null;
  const requestedPage = Number.parseInt(first(sp.page) ?? "1", 10) || 1;

  const [{ users, total, page, pageCount }, registered] = await Promise.all([
    listUsers({ q, role: role ?? undefined, page: requestedPage }),
    getRegisteredStats(),
  ]);

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        {/* En-tête : titre à gauche, nombre total d'inscrits à droite */}
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-[28px] font-semibold tracking-tight">Utilisateurs</h1>
          <UserCountBadge stats={registered} />
        </header>

        {/* Filtres */}
        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <nav aria-label="Filtrer par type" className="grid grid-cols-4 gap-1 rounded-2xl bg-surface-2/50 p-1.5 lg:w-[460px]">
            {SEGMENTS.map((s) => {
              const active = s.value === role;
              return (
                <Link
                  key={s.label}
                  href={hrefFor({ q, role: s.value })}
                  aria-current={active ? "page" : undefined}
                  className={`truncate rounded-xl px-1 py-2.5 text-center text-[13px] font-medium transition-colors ${
                    active ? "bg-accent text-background shadow-md shadow-accent/20" : "text-muted hover:text-foreground"
                  }`}
                >
                  {s.label}
                </Link>
              );
            })}
          </nav>

          <form action="/admin/utilisateurs" role="search" className="relative lg:w-[380px]">
            {role && <input type="hidden" name="role" value={role} />}
            <label htmlFor="user-search" className="sr-only">
              Rechercher un utilisateur
            </label>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
            <input
              id="user-search"
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Nom, société, ville ou projet…"
              className="w-full rounded-2xl border border-border bg-surface-2/50 py-3 pr-28 pl-11 text-sm placeholder:text-muted/70 focus:border-accent/60 focus:outline-none"
            />
            <button
              type="submit"
              className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-strong"
            >
              Chercher
            </button>
          </form>
        </div>

        <p className="mt-6 text-sm text-muted">
          {total === 0
            ? "Aucun résultat"
            : `${total} résultat${total > 1 ? "s" : ""}${q ? ` pour « ${q} »` : ""}`}
          {q && (
            <>
              {" · "}
              <Link href={hrefFor({ role })} className="text-accent-strong hover:underline">
                Effacer la recherche
              </Link>
            </>
          )}
        </p>

        {/* Grille */}
        {users.length > 0 ? (
          <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {users.map((u) => (
              <li key={u.id} className="flex flex-col [&>article]:flex-1">
                <UserCard user={u} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 rounded-[24px] border border-dashed border-border px-6 py-16 text-center text-sm text-muted">
            Aucun utilisateur ne correspond à ces critères.
          </div>
        )}

        <Pagination
          page={page}
          pageCount={pageCount}
          total={total}
          pageSize={USERS_PAGE_SIZE}
          hrefFor={(n) => hrefFor({ q, role, page: n })}
        />

      </div>
    </div>
  );
}
