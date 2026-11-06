import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CollectionView } from "@/components/resources/collection-view";
import { FolderView } from "@/components/resources/folder-view";
import type { Resource } from "@/components/resources/resource-items";
import { ResourcesHome } from "@/components/resources/resources-home";
import { requireAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/messages";
import {
  getFolder,
  listFileResources,
  listFolders,
  listLinkResources,
  listShareableUsers,
  listSharedWithMe,
  type ResourceKind,
} from "@/lib/resources";

export const metadata: Metadata = { title: "Ressources" };

const KINDS: ResourceKind[] = ["photo", "video", "document", "audio", "lien"];

/**
 * Ressources :
 * - accueil : dossiers par type, dossiers personnels, partages récents ;
 * - `?type=photo|video|document|audio|lien` : dossier automatique d'un type ;
 * - `?dossier=<id>` : dossier personnel (import, liens, ajout depuis les discussions).
 * Les ressources des discussions sont lues directement (pièces jointes et liens des messages).
 */
export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[]; dossier?: string | string[] }>;
}) {
  const sp = await searchParams;
  const type = typeof sp.type === "string" ? sp.type : null;
  const folderId = typeof sp.dossier === "string" ? sp.dossier : null;

  const admin = await requireAdmin();
  const viewer = { id: admin.id, space: "admin" } as const;
  const [files, links] = await Promise.all([listFileResources(viewer), listLinkResources(viewer)]);

  if (folderId) {
    if (!isUuid(folderId)) notFound();
    const folder = await getFolder(folderId, viewer);
    if (!folder) notFound();
    const users = await listShareableUsers();
    return <FolderView folder={folder} shared={{ files, links }} users={users} space="admin" />;
  }

  // Ressources que des utilisateurs ont autorisé l'administration à voir.
  const shared = await listSharedWithMe(viewer);
  const sharedItems: Resource[] = [...shared.files, ...shared.links].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  if (type === "partages") return <CollectionView kind="partages" items={sharedItems} space="admin" />;
  if (type && KINDS.includes(type as ResourceKind)) {
    const kind = type as ResourceKind;
    const items = kind === "lien" ? links : files.filter((f) => f.kind === kind);
    return <CollectionView kind={kind} items={items} space="admin" />;
  }

  const folders = await listFolders(admin.id);
  return <ResourcesHome files={files} links={links} folders={folders} space="admin" sharedWithMe={sharedItems} />;
}
