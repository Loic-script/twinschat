import type { Metadata } from "next";
import Link from "next/link";
import { ProjectIcon } from "@/components/brand/project-icon";
import { ProjectStatusBadge } from "@/components/users/project-status-badge";
import { displayName, formatPresence } from "@/lib/format";
import { ChatPanel } from "@/components/messages/chat-panel";
import { ProjectList } from "@/components/projects/project-list";
import { ParticipantsButton } from "@/components/projects/participants-button";
import { ParticipantsSummary } from "@/components/projects/participants-summary";
import { ProjectPanel } from "@/components/projects/project-panel";
import { ProjectValidation } from "@/components/projects/project-validation";
import { requireAdmin } from "@/lib/auth";
import { getConversation, listMessages } from "@/lib/messages";
import {
  ensureProjectConversation,
  getProjectParticipants,
  getProjectWithOwner,
  listProjectOwners,
} from "@/lib/projects";

export const metadata: Metadata = { title: "Projets" };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string | string[] }>;
}) {
  const { p } = await searchParams;
  const requestedId = typeof p === "string" ? p : null;

  const admin = await requireAdmin();
  const project = requestedId ? await getProjectWithOwner(requestedId) : null;

  // Discussion du projet (créée au premier accès), puis la liste à jour.
  let chat = null;
  if (project) {
    const conversationId = await ensureProjectConversation(project.id, project.owner.id, admin.id);
    const [conversation, messages, participants] = await Promise.all([
      getConversation(admin.id, conversationId),
      listMessages(conversationId),
      getProjectParticipants(conversationId, admin.id),
    ]);
    if (conversation) chat = { conversation, messages, participants };
  }
  const owners = await listProjectOwners(admin.id);

  return (
    <div className="flex h-full min-h-0">
      {/* Liste : toujours visible sur bureau, masquée sur mobile quand un projet est ouvert */}
      <aside
        className={`h-full w-full shrink-0 bg-background/45 md:w-[380px] md:rounded-l-[28px] md:border-r md:border-border/60 xl:w-[420px] ${
          chat ? "hidden md:block" : "block"
        }`}
      >
        <ProjectList owners={owners} activeProjectId={project?.id ?? null} />
      </aside>

      <div className={`h-full min-w-0 flex-1 ${chat ? "block" : "hidden md:block"}`}>
        {project && chat ? (
          <ChatPanel
            space="admin"
            key={chat.conversation.id}
            conversation={chat.conversation}
            messages={chat.messages}
            meId={admin.id}
            meName={admin.name}
            meAvatarUrl={admin.avatarUrl}
            backHref="/admin/projets"
            locked={
              project.status === "propose" ? (
                <ProjectValidation projectId={project.id} ownerName={displayName(project.owner)} />
              ) : undefined
            }
            heading={{
              title: project.title,
              badge: <ProjectStatusBadge status={project.status} />,
              subtitle: (
                <>
                  <Link
                    href={`/admin/utilisateurs/${project.owner.id}`}
                    className="rounded-md font-medium text-foreground/85 hover:text-accent-strong hover:underline"
                    title="Voir le profil"
                  >
                    {displayName(project.owner)}
                  </Link>
                  {" · "}
                  <span className={project.owner.status === "en_ligne" ? "text-accent-strong" : undefined}>
                    {formatPresence(project.owner.status, chat.conversation.contact.lastSeenAt)}
                  </span>
                  {" · "}
                  <ParticipantsSummary
                    members={chat.participants.members}
                    ownerId={project.owner.id}
                    adminName={admin.name}
                    adminAvatarUrl={admin.avatarUrl}
                  />
                </>
              ),
            }}
            headerActions={
              <ParticipantsButton
                conversationId={chat.conversation.id}
                ownerId={project.owner.id}
                members={chat.participants.members}
                candidates={chat.participants.candidates}
              />
            }
            details={{
              label: "Détails du projet",
              content: <ProjectPanel key={`${project.id}-${project.status}-${project.url}`} project={project} />,
            }}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-accent text-background">
              <ProjectIcon className="size-7" strokeWidth={1.6} />
            </span>
            <h2 className="text-base font-semibold">
              {requestedId ? "Projet introuvable" : "Sélectionnez un projet"}
            </h2>
            <p className="max-w-xs text-sm text-muted">
              {requestedId
                ? "Ce projet n'existe pas ou a été supprimé."
                : "Dépliez une personne ou une entreprise dans la liste, puis choisissez un de ses projets pour en discuter."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
