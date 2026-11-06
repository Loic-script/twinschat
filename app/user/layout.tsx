import { AppSidebar } from "@/components/layout/sidebar";
import { AutoRefresh } from "@/components/messages/auto-refresh";
import { requireMember } from "@/lib/auth";
import { getAdminAccount } from "@/lib/messages";
import { getMemberNotificationFeed } from "@/lib/notifications";

// Données en base : toujours rendu à la demande, jamais figé au build.
export const dynamic = "force-dynamic";

/** Espace utilisateur (clients, entreprises, utilisateurs) : même cadre que l'admin. */
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMember();
  const admin = await getAdminAccount();
  const notifications = await getMemberNotificationFeed(me.id, admin.id);
  return (
    <div className="h-dvh bg-background md:p-4 lg:p-6">
      {/* Rafraîchit messages, projets et notifications sur toutes les pages */}
      <AutoRefresh intervalMs={5000} />
      <div className="flex h-full overflow-hidden bg-surface md:rounded-[28px] md:border md:border-border/60 md:shadow-2xl md:shadow-black/40">
        <AppSidebar space="user" userName={me.name} userAvatarUrl={me.avatarUrl} notifications={notifications} />
        <main className="flex min-w-0 flex-1 flex-col pb-[64px] md:pb-0">{children}</main>
      </div>
    </div>
  );
}
