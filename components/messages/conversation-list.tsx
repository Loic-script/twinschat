"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { CheckCheck, Search, X } from "lucide-react";
import { markAllAsRead } from "@/lib/actions/messages";
import { Avatar } from "@/components/ui/avatar";
import { displayName, formatListDate } from "@/lib/format";
import type { ConversationSummary, Role } from "@/lib/types";

type RoleFilter = "tous" | Exclude<Role, "admin">;

const SEGMENTS: { value: RoleFilter; label: string }[] = [
  { value: "tous", label: "Tous" },
  { value: "client", label: "Clients" },
  { value: "entreprise", label: "Entreprises" },
  { value: "utilisateur", label: "Utilisateurs" },
];

const iconButton =
  "inline-flex size-11 items-center justify-center rounded-xl bg-surface-2/80 text-foreground/90 transition-colors hover:bg-surface-2 hover:text-accent-strong disabled:cursor-not-allowed disabled:opacity-40";

export function ConversationList({
  conversations,
  activeId,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
}) {
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [role, setRole] = useState<RoleFilter>("tous");
  const [markingAll, startMarkAll] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);

  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("fr");
    return conversations.filter((c) => {
      if (role !== "tous" && c.contact.role !== role) return false;
      if (!q) return true;
      return [c.contact.name, c.contact.email, c.contact.company ?? ""]
        .join(" ")
        .toLocaleLowerCase("fr")
        .includes(q);
    });
  }, [conversations, search, role]);

  function toggleSearch() {
    if (searchOpen) {
      setSearch("");
      setSearchOpen(false);
    } else {
      setSearchOpen(true);
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }

  const listLabel = "Toutes les discussions";

  return (
    <div className="flex h-full flex-col">
      {/* En-tête */}
      <header className="flex items-center gap-3 border-b border-border/60 px-6 py-5">
        <h1 className="mr-auto text-[26px] font-semibold tracking-tight">Discussions</h1>
        <button
          type="button"
          onClick={() => startMarkAll(() => markAllAsRead("admin"))}
          disabled={totalUnread === 0 || markingAll}
          className={iconButton}
          aria-label="Tout marquer comme lu"
          title="Tout marquer comme lu"
        >
          <CheckCheck className="size-5" />
        </button>
        <button
          type="button"
          onClick={toggleSearch}
          aria-expanded={searchOpen}
          aria-controls="conversation-search"
          className={`${iconButton} ${searchOpen ? "bg-accent/15 text-accent-strong" : ""}`}
          aria-label={searchOpen ? "Fermer la recherche" : "Rechercher"}
          title="Rechercher"
        >
          {searchOpen ? <X className="size-5" /> : <Search className="size-5" />}
        </button>
      </header>

      <div className="scroll-thin flex-1 overflow-y-auto px-6 pt-5 pb-4">
        {searchOpen && (
          <label className="relative mb-4 block" id="conversation-search">
            <span className="sr-only">Rechercher une discussion</span>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && toggleSearch()}
              placeholder="Nom, e-mail ou entreprise…"
              className="w-full rounded-2xl border border-border bg-surface-2/60 py-3 pr-4 pl-11 text-sm placeholder:text-muted/70 focus:border-accent/60 focus:outline-none"
            />
          </label>
        )}

        {/* Onglets segmentés */}
        <div
          role="group"
          aria-label="Filtrer par type de contact"
          className="grid grid-cols-4 gap-1 rounded-2xl bg-surface-2/50 p-1.5"
        >
          {SEGMENTS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setRole(s.value)}
              aria-pressed={role === s.value}
              className={`truncate rounded-xl px-1 py-2.5 text-[13px] font-medium transition-colors ${
                role === s.value
                  ? "bg-accent text-background shadow-md shadow-accent/20"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <p className="mt-6 mb-2 text-sm text-muted">
          {listLabel} ({visible.length})
        </p>

        <ul className="space-y-1">
          {visible.length === 0 && (
            <li className="rounded-2xl px-4 py-10 text-center text-sm text-muted">
              Aucune discussion trouvée.
            </li>
          )}
          {visible.map((c) => {
            const active = c.id === activeId;
            const preview = c.lastMessage
              ? c.lastMessage.deleted
                ? "Message supprimé"
                : `${c.lastMessage.fromMe ? "Vous : " : ""}${c.lastMessage.body}`
              : "Aucun message";
            return (
              <li key={c.id}>
                <Link
                  href={`/admin/messages?c=${c.id}`}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-4 rounded-2xl px-4 py-3.5 transition-colors ${
                    active ? "bg-surface-2/80" : "hover:bg-surface-2/40"
                  }`}
                >
                  <Avatar
                    name={displayName(c.contact)}
                    src={c.contact.avatarUrl}
                    status={c.contact.status}
                    size="xl"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[16px] font-semibold">{displayName(c.contact)}</span>
                      {c.lastMessage && (
                        <time
                          dateTime={c.lastMessage.at}
                          suppressHydrationWarning
                          className="ml-auto shrink-0 text-xs text-muted"
                        >
                          {formatListDate(c.lastMessage.at)}
                        </time>
                      )}
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      <span
                        className={`truncate text-sm ${
                          c.lastMessage?.deleted
                            ? "text-muted/70 italic"
                            : c.unread
                              ? "text-foreground"
                              : "text-muted"
                        }`}
                      >
                        {preview}
                      </span>
                      {c.unread > 0 && (
                        <span
                          className="ml-auto inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-background"
                          aria-label={`${c.unread} non lu${c.unread > 1 ? "s" : ""}`}
                        >
                          {c.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
