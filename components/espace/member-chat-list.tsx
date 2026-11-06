"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { CheckCheck, Plus, Search, X } from "lucide-react";
import { ProjectIcon } from "@/components/brand/project-icon";
import { Avatar } from "@/components/ui/avatar";
import { markAllAsRead } from "@/lib/actions/messages";
import { formatListDate } from "@/lib/format";
import type { Status } from "@/lib/types";

/** Une ligne de la liste (préparée côté serveur). */
export type ChatListItem = {
  key: string;
  href: string;
  title: string;
  /** Discussion avec l'admin : sa photo et sa présence. */
  person?: { name: string; avatarUrl: string | null; status: Status };
  lastMessage: { body: string; at: string; fromMe: boolean; deleted: boolean } | null;
  unread: number;
};

const iconButton =
  "inline-flex size-11 items-center justify-center rounded-xl bg-surface-2/80 text-foreground/90 transition-colors hover:bg-surface-2 hover:text-accent-strong disabled:cursor-not-allowed disabled:opacity-40";

/** Discussions de l'utilisateur : l'administration, puis les discussions de ses projets. */
export function MemberChatList({
  direct,
  projects,
  activeKey,
}: {
  direct: ChatListItem;
  projects: ChatListItem[];
  activeKey: string | null;
}) {
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [markingAll, startMarkAll] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  const totalUnread = direct.unread + projects.reduce((sum, p) => sum + p.unread, 0);

  const visibleProjects = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("fr");
    return projects.filter((p) => !q || p.title.toLocaleLowerCase("fr").includes(q));
  }, [projects, search]);

  function toggleSearch() {
    if (searchOpen) {
      setSearch("");
      setSearchOpen(false);
    } else {
      setSearchOpen(true);
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border/60 px-6 py-5">
        <h1 className="mr-auto text-[26px] font-semibold tracking-tight">Discussions</h1>
        <button
          type="button"
          onClick={() => startMarkAll(() => markAllAsRead("user"))}
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
          aria-controls="member-chat-search"
          className={`${iconButton} ${searchOpen ? "bg-accent/15 text-accent-strong" : ""}`}
          aria-label={searchOpen ? "Fermer la recherche" : "Rechercher un projet"}
          title="Rechercher"
        >
          {searchOpen ? <X className="size-5" /> : <Search className="size-5" />}
        </button>
      </header>

      <div className="scroll-thin flex-1 overflow-y-auto px-6 pt-5 pb-4">
        {searchOpen && (
          <label className="relative mb-4 block" id="member-chat-search">
            <span className="sr-only">Rechercher une discussion de projet</span>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && toggleSearch()}
              placeholder="Nom du projet…"
              className="w-full rounded-2xl border border-border bg-surface-2/60 py-3 pr-4 pl-11 text-sm placeholder:text-muted/70 focus:border-accent/60 focus:outline-none"
            />
          </label>
        )}

        <section aria-labelledby="chat-section-admin">
            <h2 id="chat-section-admin" className="mb-2 text-sm text-muted">
              Administration
            </h2>
            <ul>
              <ChatRow item={direct} active={direct.key === activeKey} />
            </ul>
          </section>

        <section className="mt-6" aria-labelledby="chat-section-projects">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 id="chat-section-projects" className="text-sm text-muted">
              Mes projets ({visibleProjects.length})
            </h2>
            <Link
              href="/user/projets?nouveau=1"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-accent-strong hover:bg-accent/10"
            >
              <Plus className="size-3.5" /> Nouveau projet
            </Link>
          </div>
          {visibleProjects.length > 0 ? (
            <ul className="space-y-1">
              {visibleProjects.map((p) => (
                <ChatRow key={p.key} item={p} active={p.key === activeKey} />
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
              {projects.length === 0
                ? "Proposez un projet : sa discussion avec l'équipe apparaîtra ici."
                : "Aucune discussion de projet trouvée."}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function ChatRow({ item, active }: { item: ChatListItem; active: boolean }) {
  const { lastMessage: last } = item;
  const preview = last ? (last.deleted ? "Message supprimé" : `${last.fromMe ? "Vous : " : ""}${last.body}`) : "Aucun message";
  return (
    <li>
      <Link
        href={item.href}
        scroll={false}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-4 rounded-2xl px-4 py-3.5 transition-colors ${
          active ? "bg-surface-2/80" : "hover:bg-surface-2/40"
        }`}
      >
        {item.person ? (
          <Avatar name={item.person.name} src={item.person.avatarUrl} status={item.person.status} size="xl" />
        ) : (
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2/70 text-muted">
            <ProjectIcon className="size-6" strokeWidth={1.9} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[16px] font-semibold">{item.title}</span>
            {last && (
              <time dateTime={last.at} suppressHydrationWarning className="ml-auto shrink-0 text-xs text-muted">
                {formatListDate(last.at)}
              </time>
            )}
          </span>
          <span className="mt-1 flex items-center gap-2">
            <span
              className={`truncate text-sm ${
                last?.deleted ? "text-muted/70 italic" : item.unread ? "text-foreground" : "text-muted"
              }`}
            >
              {preview}
            </span>
            {item.unread > 0 && (
              <span
                className="ml-auto inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-background"
                aria-label={`${item.unread} non lu${item.unread > 1 ? "s" : ""}`}
              >
                {item.unread}
              </span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}
