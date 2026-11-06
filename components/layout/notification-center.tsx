"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  Banknote,
  Bell,
  CheckCircle2,
  FolderPlus,
  MessageSquare,
  Settings2,
  Share2,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { markNotificationsSeen, updateNotificationPrefs } from "@/lib/actions/notifications";
import { Avatar } from "@/components/ui/avatar";
import { displayName, formatRelative } from "@/lib/format";
import type { NotificationFeed, NotificationItem, NotificationKind, NotificationPrefs, Space } from "@/lib/types";

const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  message: MessageSquare,
  inscription: UserPlus,
  projet: FolderPlus,
  projet_termine: CheckCircle2,
  mon_projet_termine: CheckCircle2,
  mon_projet_paye: Banknote,
  ajout_discussion: Users,
  partage: Share2,
};

/** Texte d'une notification, partagé avec les notifications du navigateur. */
export function notificationText(n: NotificationItem) {
  const who = displayName(n.actor);
  const detail = n.detail ?? "";
  switch (n.kind) {
    case "message":
      return { title: `${who} vous a envoyé un message`, body: detail };
    case "inscription":
      return { title: `${who} a rejoint TwinsChat`, body: "Nouvelle inscription" };
    case "projet":
      return { title: `${who} a proposé un projet`, body: detail };
    case "projet_termine":
      return { title: `Projet terminé · ${who}`, body: detail };
    case "mon_projet_termine":
      return { title: "Votre projet est terminé", body: detail };
    case "mon_projet_paye":
      return { title: "Paiement enregistré pour votre projet", body: detail };
    case "ajout_discussion":
      return { title: `${who} vous a ajouté à la discussion d'un projet`, body: detail };
    case "partage":
      return { title: `${who} a partagé une ressource avec vous`, body: detail };
  }
}

/** Préférences proposées et texte d'accueil, selon l'espace. */
const SPACE_COPY: Record<Space, { rows: { key: keyof NotificationPrefs; label: string; hint: string }[]; empty: string }> = {
  admin: {
    rows: [
      { key: "messages", label: "Nouveaux messages", hint: "Messages reçus des utilisateurs, clients et entreprises" },
      { key: "inscriptions", label: "Nouvelles inscriptions", hint: "Personnes qui rejoignent TwinsChat" },
      { key: "projets", label: "Projets", hint: "Projets proposés et projets terminés" },
      { key: "ressources", label: "Ressources partagées", hint: "Fichiers et liens que les utilisateurs vous autorisent à voir" },
    ],
    empty: "Les nouveaux messages, inscriptions et projets apparaîtront ici.",
  },
  user: {
    rows: [
      { key: "messages", label: "Nouveaux messages", hint: "Messages de l'administration et des discussions de projet" },
      { key: "projets", label: "Mes projets", hint: "Projet terminé, paiement enregistré, ajout à une discussion" },
      { key: "ressources", label: "Ressources partagées", hint: "Fichiers et liens partagés avec vous" },
    ],
    empty: "Les nouveaux messages, l'avancement de vos projets et les partages apparaîtront ici.",
  },
};

type Variant = "rail" | "mobile";

export function NotificationCenter({
  feed,
  variant,
  space = "admin",
}: {
  feed: NotificationFeed;
  variant: Variant;
  space?: Space;
}) {
  const copy = SPACE_COPY[space];
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "settings">("list");
  // Notifications non lues au moment de l'ouverture : restent en évidence pendant la consultation.
  const [highlight, setHighlight] = useState<Set<string>>(new Set());
  const [prefs, setPrefs] = useState(feed.prefs);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setPrefs(feed.prefs), [feed.prefs]);

  useEffect(() => {
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, [open]);

  // Fermeture au clic extérieur et avec Échap.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setView("list");
    setHighlight(new Set(feed.items.filter((i) => i.unread).map((i) => i.id)));
    setOpen(true);
    if (feed.unreadCount > 0) startTransition(() => markNotificationsSeen(space));
  }

  async function changePref(key: keyof NotificationPrefs, value: boolean) {
    if (key === "navigateur" && value) {
      if (typeof Notification === "undefined") return;
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return;
    }
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    startTransition(() => updateNotificationPrefs(space, next));
  }

  const count = feed.unreadCount;
  const badge = count > 9 ? "9+" : String(count);
  const label = count > 0 ? `Notifications, ${count} nouvelle${count > 1 ? "s" : ""}` : "Notifications";

  return (
    <div ref={rootRef} className={variant === "mobile" ? "flex flex-1" : undefined}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={label}
        title="Notifications"
        className={
          variant === "rail"
            ? `relative inline-flex size-[52px] items-center justify-center rounded-2xl transition-colors ${
                open ? "bg-accent/15 text-accent-strong" : "bg-surface-2/70 text-muted hover:bg-surface-2 hover:text-foreground"
              }`
            : `relative flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] ${
                open ? "bg-accent/15 text-accent-strong" : "text-muted"
              }`
        }
      >
        <span className="relative">
          <Bell className={variant === "rail" ? "size-[22px]" : "size-5"} strokeWidth={1.9} />
          {count > 0 && (
            <span className="absolute -top-2 -right-2.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-surface bg-accent px-1 text-[10px] font-bold text-background">
              {badge}
            </span>
          )}
        </span>
        {variant === "mobile" && "Notifications"}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-3 bottom-[76px] z-50 flex max-h-[min(640px,75vh)] flex-col overflow-hidden rounded-[24px] border border-border bg-surface shadow-2xl shadow-black/60 md:inset-x-auto md:bottom-6 md:left-[120px] md:w-[400px] lg:left-[128px]"
        >
          <header className="flex items-center gap-2 border-b border-border/60 px-5 py-4">
            <h2 className="mr-auto text-lg font-semibold">
              {view === "list" ? "Notifications" : "Préférences"}
            </h2>
            <button
              type="button"
              onClick={() => setView((v) => (v === "list" ? "settings" : "list"))}
              aria-pressed={view === "settings"}
              aria-label="Préférences de notification"
              title="Préférences"
              className={`inline-flex size-9 items-center justify-center rounded-xl transition-colors ${
                view === "settings" ? "bg-accent/15 text-accent-strong" : "text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <Settings2 className="size-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="inline-flex size-9 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-foreground"
            >
              <X className="size-[18px]" />
            </button>
          </header>

          {view === "list" ? (
            <NotificationList
              items={feed.items}
              highlight={highlight}
              emptyText={copy.empty}
              onNavigate={() => setOpen(false)}
            />
          ) : (
            <div className="scroll-thin overflow-y-auto px-5 py-4">
              <p className="text-xs font-medium tracking-wide text-muted uppercase">Afficher</p>
              <ul className="mt-2 divide-y divide-border/50">
                {copy.rows.map((row) => (
                  <PrefSwitch
                    key={row.key}
                    label={row.label}
                    hint={row.hint}
                    checked={prefs[row.key]}
                    onChange={(v) => changePref(row.key, v)}
                  />
                ))}
              </ul>
              <p className="mt-5 text-xs font-medium tracking-wide text-muted uppercase">Navigateur</p>
              <ul className="mt-2">
                <PrefSwitch
                  label="Notifications du navigateur"
                  hint={
                    permission === "unsupported"
                      ? "Non prises en charge par ce navigateur"
                      : permission === "denied"
                        ? "Bloquées : autorisez-les dans les réglages du site"
                        : "Alerte système quand l'onglet est en arrière-plan"
                  }
                  checked={prefs.navigateur && permission === "granted"}
                  disabled={permission === "unsupported" || permission === "denied"}
                  onChange={(v) => changePref("navigateur", v)}
                />
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationList({
  items,
  highlight,
  emptyText,
  onNavigate,
}: {
  items: NotificationItem[];
  highlight: Set<string>;
  emptyText: string;
  onNavigate: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-accent text-background">
          <Bell className="size-5" />
        </span>
        <p className="text-sm font-medium">Aucune notification</p>
        <p className="text-xs text-muted">{emptyText}</p>
      </div>
    );
  }

  return (
    <ul className="scroll-thin overflow-y-auto p-2">
      {items.map((n) => {
        const Icon = KIND_ICON[n.kind];
        const { title, body } = notificationText(n);
        const isNew = highlight.has(n.id);
        return (
          <li key={n.id}>
            <Link
              href={n.href}
              onClick={onNavigate}
              className={`flex items-start gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-surface-2/70 ${
                isNew ? "bg-surface-2/40" : ""
              }`}
            >
              <span className="relative mt-0.5">
                <Avatar name={displayName(n.actor)} size="lg" />
                <span className="absolute -right-1 -bottom-1 inline-flex size-5 items-center justify-center rounded-full border-2 border-surface bg-surface-2 text-foreground/80">
                  <Icon className="size-3" />
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm leading-snug ${isNew ? "font-semibold" : "font-medium text-foreground/90"}`}>
                  {title}
                </span>
                {body && <span className="mt-0.5 block truncate text-xs text-muted">{body}</span>}
                <span className="mt-1 block text-[11px] text-muted/80" suppressHydrationWarning>
                  {formatRelative(n.at)}
                </span>
              </span>
              {isNew && <span aria-label="Nouvelle" className="mt-2 size-2 shrink-0 rounded-full bg-accent" />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function PrefSwitch({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <li className="flex items-center gap-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          checked ? "bg-accent" : "bg-surface-2"
        }`}
      >
        <span
          className={`inline-block size-5 rounded-full bg-foreground shadow transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </li>
  );
}

/**
 * Affiche une notification système pour les nouveautés arrivées pendant que
 * l'onglet est en arrière-plan (si l'admin l'a activé). À monter une seule fois.
 */
export function BrowserNotifier({ feed }: { feed: NotificationFeed }) {
  const newestSeen = useRef<string | null>(null);

  useEffect(() => {
    const newest = feed.items[0]?.at ?? null;
    const previous = newestSeen.current;
    if (newest) newestSeen.current = newest;
    if (previous === null || !newest) return; // premier rendu : rien à signaler

    if (!feed.prefs.navigateur || typeof Notification === "undefined") return;
    if (Notification.permission !== "granted" || document.visibilityState === "visible") return;

    feed.items
      .filter((n) => n.unread && n.at > previous)
      .slice(0, 3)
      .forEach((n) => {
        const { title, body } = notificationText(n);
        const notif = new Notification(title, { body, icon: "/brand/twinschat-icon.svg", tag: n.id });
        notif.onclick = () => {
          window.focus();
          window.location.href = n.href;
        };
      });
  }, [feed]);

  return null;
}
