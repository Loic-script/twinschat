"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChartColumn, FolderOpen, MessagesSquare, UserRound, Users, type LucideIcon } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { LogoMark } from "@/components/brand/logo";
import { ProjectIcon } from "@/components/brand/project-icon";
import { NotificationCenter } from "@/components/layout/notification-center";
import { PushBridge } from "@/components/layout/push-client";
import { FallbackImage } from "@/components/ui/fallback-image";
import { initials } from "@/lib/format";
import type { NotificationFeed, Space } from "@/lib/types";

/** `short` : libellé de la barre du bas sur mobile, si le libellé complet est trop long. */
/** `desktopOnly` : seulement dans la barre latérale (la barre du bas mobile est limitée à 5 boutons). */
type NavItem = { href: string; label: string; short?: string; icon: LucideIcon | typeof ProjectIcon; desktopOnly?: boolean };

/** Menus de chaque espace (les icônes restent côté client : pas de composants en props). */
const SPACES: Record<Space, { label: string; home: string; profile: { href: string; label: string }; nav: NavItem[] }> = {
  admin: {
    label: "Navigation admin",
    home: "/admin/messages",
    profile: { href: "/admin/profil", label: "Profil admin" },
    nav: [
      { href: "/admin/messages", label: "Messages", icon: MessagesSquare },
      { href: "/admin/utilisateurs", label: "Utilisateurs", icon: Users },
      { href: "/admin/projets", label: "Projets", icon: ProjectIcon },
      { href: "/admin/statistiques", label: "Statistiques", short: "Stats", icon: ChartColumn },
      { href: "/admin/ressources", label: "Ressources", icon: FolderOpen },
    ],
  },
  user: {
    label: "Navigation",
    home: "/user/messages",
    profile: { href: "/user/profil", label: "Mon profil" },
    nav: [
      { href: "/user/messages", label: "Messages", icon: MessagesSquare },
      { href: "/user/projets", label: "Projets", icon: ProjectIcon },
      { href: "/user/ressources", label: "Ressources", icon: FolderOpen },
      { href: "/user/guide", label: "Guide d'utilisation", icon: BookOpen, desktopOnly: true },
    ],
  },
};

export function AppSidebar({
  space,
  userName,
  userAvatarUrl,
  notifications,
}: {
  space: Space;
  userName: string;
  userAvatarUrl: string | null;
  notifications: NotificationFeed;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const { label, home, profile, nav } = SPACES[space];
  const profileActive = isActive(profile.href);

  // Dernier passage dans chaque rubrique (mémorisé sur l'appareil) : le point vert ne signale que les nouveautés depuis.
  const visitedKey = `twinschat:rubriques-vues:${space}`;
  // `null` tant que l'appareil n'a pas été lu : aucun point affiché (évite un clignotement au chargement)
  const [visited, setVisited] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    let stored: Record<string, string> = {};
    try {
      stored = JSON.parse(localStorage.getItem(visitedKey) ?? "{}");
    } catch {
      /* stockage indisponible */
    }
    // Rubrique ouverte : marquée comme vue maintenant
    const section = nav.find((n) => isActive(n.href));
    const next = section ? { ...stored, [section.href]: new Date().toISOString() } : stored;
    if (section) {
      try {
        localStorage.setItem(visitedKey, JSON.stringify(next));
      } catch {
        /* stockage indisponible */
      }
    }
    setVisited(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- à chaque changement de page
  }, [pathname, visitedKey]);

  /** Notification non lue qui mène à cette rubrique, arrivée depuis le dernier passage (et pas sur la page en cours). */
  const hasNews = (href: string) =>
    visited !== null &&
    !isActive(href) &&
    notifications.items.some(
      (i) =>
        i.unread &&
        (i.href === href || i.href.startsWith(`${href}?`) || i.href.startsWith(`${href}/`)) &&
        (!visited[href] || i.at > visited[href]),
    );

  return (
    <>
      {/* Notifications push : service worker, abonnement de l'appareil, mise à jour en temps réel */}
      <PushBridge space={space} />

      {/* Rail vertical (tablette et bureau) */}
      <nav aria-label={label} className="hidden w-[92px] shrink-0 flex-col items-center gap-4 py-7 md:flex">
        <Link
          href={home}
          aria-label="TwinsChat, accueil"
          title="TwinsChat"
          className="mb-4 inline-flex size-[52px] items-center justify-center rounded-2xl transition-transform hover:scale-105"
        >
          <LogoMark className="w-12" typing={false} gradientId="tc-bubble-rail" />
        </Link>
        {nav.map(({ href, label: itemLabel, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            title={hasNews(href) ? `${itemLabel} : nouveautés` : itemLabel}
            aria-label={hasNews(href) ? `${itemLabel}, nouveautés` : itemLabel}
            aria-current={isActive(href) ? "page" : undefined}
            className={`relative inline-flex size-[52px] items-center justify-center rounded-2xl transition-colors ${
              isActive(href)
                ? "bg-accent text-background shadow-lg shadow-accent/25"
                : "bg-surface-2/70 text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            <Icon className="size-[22px]" strokeWidth={1.9} />
            {hasNews(href) && <NewsDot className="top-2.5 right-2.5" />}
          </Link>
        ))}
        <div className="mt-auto">
          <NotificationCenter feed={notifications} variant="rail" space={space} />
        </div>
        <Link
          href={profile.href}
          title={profile.label}
          aria-label={profile.label}
          aria-current={profileActive ? "page" : undefined}
          className={`inline-flex size-[52px] items-center justify-center rounded-full bg-gradient-to-br from-accent-strong/30 to-surface-2 text-sm font-semibold ring-2 ring-offset-2 ring-offset-surface transition ${
            profileActive ? "ring-accent" : "ring-transparent hover:ring-border"
          }`}
        >
          {userAvatarUrl ? (
            <FallbackImage src={userAvatarUrl} className="size-full rounded-full object-cover" fallback={initials(userName)} />
          ) : (
            initials(userName)
          )}
        </Link>
        <LogoutButton variant="rail" />
      </nav>

      {/* Barre du bas (mobile) */}
      <nav
        aria-label={label}
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-surface px-2 py-1.5 md:hidden"
      >
        {nav.filter((n) => !n.desktopOnly).map(({ href, label: itemLabel, short, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            aria-label={hasNews(href) ? `${itemLabel}, nouveautés` : undefined}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] ${
              isActive(href) ? "bg-accent/15 text-accent-strong" : "text-muted"
            }`}
          >
            <span className="relative">
              <Icon className="size-5" strokeWidth={1.9} />
              {hasNews(href) && <NewsDot className="-top-0.5 -right-1" />}
            </span>
            {short ?? itemLabel}
          </Link>
        ))}
        <NotificationCenter feed={notifications} variant="mobile" space={space} />
        <Link
          href={profile.href}
          aria-current={profileActive ? "page" : undefined}
          className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] ${
            profileActive ? "bg-accent/15 text-accent-strong" : "text-muted"
          }`}
        >
          <UserRound className="size-5" strokeWidth={1.9} />
          Profil
        </Link>
      </nav>
    </>
  );
}

/** Point vert « nouveautés » sur une rubrique (pulsation douce, coupée si les animations sont réduites). */
function NewsDot({ className }: { className: string }) {
  return (
    <span aria-hidden className={`pointer-events-none absolute flex size-2.5 ${className}`}>
      <span className="absolute inset-0 rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
      <span className="relative size-2.5 rounded-full bg-accent ring-2 ring-surface" />
    </span>
  );
}
