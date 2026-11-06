import { AppSidebar } from "@/components/layout/sidebar";
import { AutoRefresh } from "@/components/messages/auto-refresh";
import { requireAdmin } from "@/lib/auth";
import { getNotificationFeed } from "@/lib/notifications";

// Données en base : toujours rendu à la demande, jamais figé au build.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const notifications = await getNotificationFeed(admin.id);
  return (
    <div className="h-dvh bg-background md:p-4 lg:p-6">
      {/* Rafraîchit messages, compteurs et notifications sur toutes les pages admin */}
      <AutoRefresh intervalMs={5000} />
      {/* Cadre de l'application */}
      <div className="flex h-full overflow-hidden bg-surface md:rounded-[28px] md:border md:border-border/60 md:shadow-2xl md:shadow-black/40">
        <AppSidebar space="admin" userName={admin.name} userAvatarUrl={admin.avatarUrl} notifications={notifications} />
        <main className="flex min-w-0 flex-1 flex-col pb-[64px] md:pb-0">{children}</main>
      </div>
    </div>
  );
}
