import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MessagesSquare, ShieldCheck } from "lucide-react";
import { ProjectIcon } from "@/components/brand/project-icon";
import { MemberChatList, type ChatListItem } from "@/components/espace/member-chat-list";
import { MemberProjectPanel } from "@/components/espace/project-info";
import { ChatPanel } from "@/components/messages/chat-panel";
import { ParticipantsSummary } from "@/components/projects/participants-summary";
import { ProjectPendingNotice } from "@/components/projects/project-validation";
import { requireMember } from "@/lib/auth";
import { displayName, formatPresence } from "@/lib/format";
import {
  ensureDirectConversation,
  getAdminAccount,
  getConversation,
  listMemberConversations,
  listMessages,
} from "@/lib/messages";
import {
  ensureProjectConversation,
  getConversationMembers,
  getMemberProject,
  listMemberProjects,
  type Participant,
  type ProjectWithOwner,
} from "@/lib/projects";
import type { ConversationSummary, Message } from "@/lib/types";

export const metadata: Metadata = { title: "Messages" };

type OpenChat = {
  conversation: ConversationSummary;
  messages: Message[];
  project?: { data: ProjectWithOwner; members: Participant[] };
};

const first = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

/**
 * Messages de l'utilisateur :
 * - `?c=<id>` : discussion directe avec l'administration ;
 * - `?p=<projet>` : discussion d'un de ses projets (ou d'un projet auquel l'admin l'a ajouté).
 */
export default async function MemberMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[]; p?: string | string[] }>;
}) {
  const sp = await searchParams;
  const requestedConversation = first(sp.c);
  const requestedProject = first(sp.p);

  const me = await requireMember();
  const admin = await getAdminAccount();
  // La discussion avec l'administration existe toujours (créée à la première visite).
  const directId = await ensureDirectConversation(me.id, admin.id);

  let chat: OpenChat | null = null;
  if (requestedProject) {
    const project = await getMemberProject(requestedProject, me.id);
    if (project) {
      const conversationId = await ensureProjectConversation(project.id, project.owner.id, admin.id);
      const [conversation, messages, members] = await Promise.all([
        getConversation(me.id, conversationId),
        listMessages(conversationId),
        getConversationMembers(conversationId),
      ]);
      if (conversation) chat = { conversation, messages, project: { data: project, members } };
    }
  } else if (requestedConversation) {
    const conversation = await getConversation(me.id, requestedConversation);
    // Une discussion de projet s'ouvre par son projet (en-tête, détails, participants).
    if (conversation?.project) redirect(`/user/messages?p=${conversation.project.id}`);
    if (conversation) chat = { conversation, messages: await listMessages(conversation.id) };
  }
  const notFound = (requestedProject !== null || requestedConversation !== null) && !chat;

  const [conversations, projects] = await Promise.all([listMemberConversations(me.id), listMemberProjects(me.id)]);

  // Liste : l'administration, puis les projets (les siens et ceux où il a été ajouté).
  const directSummary = conversations.find((c) => c.id === directId);
  const direct: ChatListItem = {
    key: "direct",
    href: `/user/messages?c=${directId}`,
    title: displayName(directSummary?.contact ?? { name: admin.name, role: "admin", company: null }),
    person: {
      name: admin.name,
      avatarUrl: directSummary?.contact.avatarUrl ?? admin.avatarUrl,
      status: directSummary?.contact.status ?? "hors_ligne",
    },
    lastMessage: directSummary?.lastMessage ?? null,
    unread: directSummary?.unread ?? 0,
  };

  const byProject = new Map(conversations.filter((c) => c.project).map((c) => [c.project!.id, c]));
  const projectItems: (ChatListItem & { activity: string })[] = [
    ...projects.map((p) => {
      const c = byProject.get(p.id);
      return {
        key: `projet:${p.id}`,
        href: `/user/messages?p=${p.id}`,
        title: p.title,
        lastMessage: c?.lastMessage ?? null,
        unread: c?.unread ?? 0,
        activity: c?.lastMessage?.at ?? p.createdAt,
      };
    }),
    ...conversations
      .filter((c) => c.project && c.project.ownerId !== me.id)
      .map((c) => ({
        key: `projet:${c.project!.id}`,
        href: `/user/messages?p=${c.project!.id}`,
        title: c.project!.title,
        lastMessage: c.lastMessage,
        unread: c.unread,
        activity: c.lastMessage?.at ?? "",
      })),
  ].sort((a, b) => b.activity.localeCompare(a.activity));

  const activeKey = chat?.project ? `projet:${chat.project.data.id}` : chat ? "direct" : null;

  return (
    <div className="flex h-full min-h-0">
      {/* Liste : toujours visible sur bureau, masquée sur mobile quand une discussion est ouverte */}
      <aside
        className={`h-full w-full shrink-0 bg-background/45 md:w-[380px] md:rounded-l-[28px] md:border-r md:border-border/60 xl:w-[420px] ${
          chat ? "hidden md:block" : "block"
        }`}
      >
        <MemberChatList direct={direct} projects={projectItems} activeKey={activeKey} />
      </aside>

      <div className={`h-full min-w-0 flex-1 ${chat ? "block" : "hidden md:block"}`}>
        {chat?.project ? (
          <ChatPanel
            space="user"
            key={chat.conversation.id}
            conversation={chat.conversation}
            messages={chat.messages}
            meId={me.id}
            meName={me.name}
            meAvatarUrl={me.avatarUrl}
            backHref="/user/messages"
            canModerate={false}
            composerPlaceholder="Écrire un message sur ce projet…"
            locked={chat.project.data.status === "propose" ? <ProjectPendingNotice /> : undefined}
            avatar={<ProjectAvatar />}
            heading={{
              title: chat.project.data.title,
              subtitle: (
                <ProjectSubtitle
                  caption={
                    chat.project.data.owner.id === me.id
                      ? "Votre projet"
                      : `Projet de ${displayName(chat.project.data.owner)}`
                  }
                  members={chat.project.members}
                  ownerId={chat.project.data.owner.id}
                  adminName={admin.name}
                  adminAvatarUrl={admin.avatarUrl}
                  viewerId={me.id}
                />
              ),
            }}
            details={{
              label: "Détails du projet",
              content: (
                <MemberProjectPanel
                  key={`${chat.project.data.id}-${chat.project.data.status}`}
                  project={chat.project.data}
                  isOwner={chat.project.data.owner.id === me.id}
                />
              ),
            }}
          />
        ) : chat ? (
          <ChatPanel
            space="user"
            key={chat.conversation.id}
            conversation={chat.conversation}
            messages={chat.messages}
            meId={me.id}
            meName={me.name}
            meAvatarUrl={me.avatarUrl}
            backHref="/user/messages"
            canModerate={false}
            composerPlaceholder="Écrire à l'administration…"
            heading={{
              title: displayName(chat.conversation.contact),
              badge: <AdminBadge />,
              subtitle: (
                <AdminPresence
                  online={chat.conversation.contact.status === "en_ligne"}
                  label={formatPresence(chat.conversation.contact.status, chat.conversation.contact.lastSeenAt)}
                />
              ),
            }}
          />
        ) : (
          <Welcome name={me.name} directHref={direct.href} notFound={notFound} />
        )}
      </div>
    </div>
  );
}

/*
 * Morceaux d'en-tête passés au ChatPanel (composant client) : chacun est un petit composant
 * serveur, pour que le panneau reçoive un seul élément par emplacement.
 */

/** Avatar d'une discussion de projet : l'icône Projets. */
function ProjectAvatar() {
  return (
    <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2/70 text-muted">
      <ProjectIcon className="size-6" strokeWidth={1.9} />
    </span>
  );
}

/** « Votre projet · N participants » (liste des membres au clic, sans liens vers les profils). */
function ProjectSubtitle({
  caption,
  members,
  ownerId,
  adminName,
  adminAvatarUrl,
  viewerId,
}: {
  caption: string;
  members: Participant[];
  ownerId: string;
  adminName: string;
  adminAvatarUrl: string | null;
  viewerId: string;
}) {
  return (
    <>
      {caption}
      {" · "}
      <ParticipantsSummary
        members={members}
        ownerId={ownerId}
        adminName={adminName}
        adminAvatarUrl={adminAvatarUrl}
        viewerId={viewerId}
      />
    </>
  );
}

/** Pastille « Administration » de l'en-tête de la discussion directe. */
function AdminBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface-2/40 px-2 py-0.5 text-[11px] font-medium text-foreground/75">
      <ShieldCheck className="size-3" /> Administration
    </span>
  );
}

/** Présence de l'admin, puis « Équipe Twins Dev ». */
function AdminPresence({ online, label }: { online: boolean; label: string }) {
  return (
    <>
      <span className={online ? "font-medium text-accent-strong" : undefined}>{label}</span>
      {" · Équipe Twins Dev"}
    </>
  );
}

function Welcome({ name, directHref, notFound }: { name: string; directHref: string; notFound: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-accent text-background">
        <MessagesSquare className="size-7" strokeWidth={1.6} />
      </span>
      <h2 className="text-base font-semibold">
        {notFound ? "Discussion introuvable" : `Bonjour ${name.split(" ")[0]} !`}
      </h2>
      <p className="max-w-sm text-sm text-muted">
        {notFound
          ? "Cette discussion n'existe pas ou vous n'y avez pas accès."
          : "Écrivez à l'administration, ou ouvrez la discussion d'un de vos projets pour échanger avec l'équipe."}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Link
          href={directHref}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background hover:bg-accent-strong"
        >
          <ShieldCheck className="size-4" /> Écrire à l&apos;administration
        </Link>
        <Link
          href="/user/projets?nouveau=1"
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-surface-2"
        >
          <ProjectIcon className="size-4" /> Proposer un projet
        </Link>
      </div>
    </div>
  );
}
