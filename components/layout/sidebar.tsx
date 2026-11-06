"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartColumn, FolderOpen, MessagesSquare, UserRound, Users, type LucideIcon } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { LogoMark } from "@/components/brand/logo";
import { ProjectIcon } from "@/components/brand/project-icon";
import { BrowserNotifier, NotificationCenter } from "@/components/layout/notification-center";
import { initials } from "@/lib/format";
import type { NotificationFeed, Space } from "@/lib/types";

/** `short` : libellé de la barre du bas sur mobile, si le libellé complet est trop long. */
type NavItem = { href: string; label: string; short?: string; icon: LucideIcon | typeof ProjectIcon };

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

  return (
    <>
      <BrowserNotifier feed={notifications} />

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
            title={itemLabel}
            aria-label={itemLabel}
            aria-current={isActive(href) ? "page" : undefined}
            className={`inline-flex size-[52px] items-center justify-center rounded-2xl transition-colors ${
              isActive(href)
                ? "bg-accent text-background shadow-lg shadow-accent/25"
                : "bg-surface-2/70 text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            <Icon className="size-[22px]" strokeWidth={1.9} />
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
            // eslint-disable-next-line @next/next/no-img-element -- photo privée servie par l'API
            <img src={userAvatarUrl} alt="" className="size-full rounded-full object-cover" />
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
        {nav.map(({ href, label: itemLabel, short, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] ${
              isActive(href) ? "bg-accent/15 text-accent-strong" : "text-muted"
            }`}
          >
            <Icon className="size-5" strokeWidth={1.9} />
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
