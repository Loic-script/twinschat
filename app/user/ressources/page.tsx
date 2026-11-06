import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CollectionView } from "@/components/resources/collection-view";
import { FolderView } from "@/components/resources/folder-view";
import type { Resource } from "@/components/resources/resource-items";
import { ResourcesHome } from "@/components/resources/resources-home";
import { requireMember } from "@/lib/auth";
import { isUuid } from "@/lib/messages";
import {
  getFolder,
  listFileResources,
  listFolders,
  listLinkResources,
  listSharedWithMe,
  type ResourceKind,
} from "@/lib/resources";

export const metadata: Metadata = { title: "Ressources" };

const KINDS: ResourceKind[] = ["photo", "video", "document", "audio", "lien"];

/**
 * Ressources de l'utilisateur, comme chez l'admin mais privées :
 * - ce qui a été envoyé dans SES discussions (avec l'administration, ses projets) ;
 * - SES dossiers (personne d'autre n'y a accès, pas de partage possible) ;
 * - ce que l'admin a choisi de partager avec lui (`?type=partages`).
 */
export default async function MemberResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[]; dossier?: string | string[] }>;
}) {
  const sp = await searchParams;
  const type = typeof sp.type === "string" ? sp.type : null;
  const folderId = typeof sp.dossier === "string" ? sp.dossier : null;

  const me = await requireMember();
  const viewer = { id: me.id, space: "user" } as const;
  const [files, links] = await Promise.all([listFileResources(viewer), listLinkResources(viewer)]);

  if (folderId) {
    if (!isUuid(folderId)) notFound();
    const folder = await getFolder(folderId, viewer);
    if (!folder) notFound();
    // Sans `users` : aucun partage, le dossier reste privé.
    return <FolderView folder={folder} shared={{ files, links }} space="user" />;
  }

  const shared = await listSharedWithMe(viewer);
  const sharedItems: Resource[] = [...shared.files, ...shared.links].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  if (type === "partages") return <CollectionView kind="partages" items={sharedItems} space="user" />;
  if (type && KINDS.includes(type as ResourceKind)) {
    const kind = type as ResourceKind;
    const items = kind === "lien" ? links : files.filter((f) => f.kind === kind);
    return <CollectionView kind={kind} items={items} space="user" />;
  }

  const folders = await listFolders(me.id);
  return <ResourcesHome files={files} links={links} folders={folders} space="user" sharedWithMe={sharedItems} />;
}
