import type { Metadata } from "next";
import { MessagesSquare } from "lucide-react";
import { ChatPanel } from "@/components/messages/chat-panel";
import { ConversationList } from "@/components/messages/conversation-list";
import { requireAdmin } from "@/lib/auth";
import { getConversation, listConversations, listMessages } from "@/lib/messages";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const { c } = await searchParams;
  const requestedId = typeof c === "string" ? c : null;

  const admin = await requireAdmin();
  const [conversations, active] = await Promise.all([
    listConversations(admin.id),
    requestedId ? getConversation(admin.id, requestedId) : Promise.resolve(null),
  ]);
  const messages = active ? await listMessages(active.id) : [];

  return (
    <div className="flex h-full min-h-0">

      {/* Liste : toujours visible sur bureau, masquée sur mobile quand une discussion est ouverte */}
      <aside
        className={`h-full w-full shrink-0 bg-background/45 md:w-[380px] md:rounded-l-[28px] md:border-r md:border-border/60 xl:w-[420px] ${
          active ? "hidden md:block" : "block"
        }`}
      >
        <ConversationList conversations={conversations} activeId={active?.id ?? null} />
      </aside>

      <div className={`h-full min-w-0 flex-1 ${active ? "block" : "hidden md:block"}`}>
        {active ? (
          <ChatPanel
            space="admin"
            key={active.id}
            conversation={active}
            messages={messages}
            meId={admin.id}
            meName={admin.name}
            meAvatarUrl={admin.avatarUrl}
          />
        ) : (
          <EmptyState notFound={requestedId !== null} />
        )}
      </div>
    </div>
  );
}

function EmptyState({ notFound }: { notFound: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-accent text-background">
        <MessagesSquare className="size-7" strokeWidth={1.6} />
      </span>
      <h2 className="text-base font-semibold">
        {notFound ? "Discussion introuvable" : "Sélectionnez une discussion"}
      </h2>
      <p className="max-w-xs text-sm text-muted">
        {notFound
          ? "Cette discussion n'existe pas ou a été supprimée."
          : "Choisissez un utilisateur, un client ou une entreprise dans la liste pour lire et répondre à ses messages."}
      </p>
    </div>
  );
}
