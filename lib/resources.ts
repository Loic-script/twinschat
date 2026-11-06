import "server-only";
import { attachmentKind } from "./attachments";
import { query } from "./db";
import { displayName } from "./format";
import type { Role, Space, Status } from "./types";

/** Utilisateur ayant reçu l'accès à un élément de dossier. */
export type AccessUser = { id: string; name: string; role: Role; company: string | null; status: Status };

export type ResourceKind = "photo" | "video" | "audio" | "document" | "lien";

/** Compte qui consulte les ressources, et son espace (pour les liens « Voir dans la discussion »). */
export type Viewer = { id: string; space: Space };

/** Expéditeur ou auteur d'une ressource ; `isMe` : le compte qui consulte (affiché « Vous »). */
type Person = { id: string; name: string; role: Role; company: string | null; isMe?: boolean };

/** Discussion d'où provient la ressource, avec un lien direct vers le message. */
export type ResourceSource = { type: "discussion" | "projet"; label: string; href: string };

export type FileResource = {
  kind: Exclude<ResourceKind, "lien">;
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
  sender: Person;
  /** `null` pour un fichier importé directement dans un dossier. */
  source: ResourceSource | null;
  /** Identifiant de l'élément dans un dossier (vue dossier uniquement). */
  itemId?: string;
  /** Utilisateurs autorisés (vue dossier uniquement). */
  access?: AccessUser[];
  /** Ressource partagée avec l'utilisateur : nom de la personne qui l'a partagée. */
  sharedBy?: string;
};

export type LinkResource = {
  kind: "lien";
  id: string;
  url: string;
  host: string;
  /** Titre donné lors de l'ajout manuel dans un dossier. */
  title?: string | null;
  createdAt: string;
  sender: Person;
  /** `null` pour un lien ajouté directement dans un dossier. */
  source: ResourceSource | null;
  /** Message d'origine (pour l'ajouter à un dossier en gardant sa provenance). */
  messageId?: string;
  itemId?: string;
  /** Utilisateurs autorisés (vue dossier uniquement). */
  access?: AccessUser[];
  /** Ressource partagée avec l'utilisateur : nom de la personne qui l'a partagée. */
  sharedBy?: string;
};

const LIMIT = 500;

/**
 * Le compte `me` (paramètre SQL, ex. "$2") peut-il consulter la pièce jointe `a` ?
 * Requiert `messages m` joint en LEFT JOIN sur a.message_id. Règle unique, utilisée
 * pour les listes, les dossiers et le téléchargement (/api/fichiers/[id]) :
 * - membre de la discussion, message non supprimé (ou fichier qu'il est en train d'envoyer) ;
 * - fichier importé directement dans un dossier : seulement par son auteur ;
 * - élément partagé avec lui par l'admin (resource_item_access), message non supprimé.
 */
export function canAccessAttachment(me: string) {
  return `(
    (a.conversation_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM conversation_members acm
                  WHERE acm.conversation_id = a.conversation_id AND acm.user_id = ${me})
     AND ((a.message_id IS NOT NULL AND m.deleted_at IS NULL)
          OR (a.message_id IS NULL AND a.uploaded_by = ${me})))
    OR (a.conversation_id IS NULL AND a.uploaded_by = ${me})
    OR ((a.message_id IS NULL OR m.deleted_at IS NULL)
        AND EXISTS (SELECT 1 FROM resource_folder_items ai
                      JOIN resource_item_access ara ON ara.item_id = ai.id
                     WHERE ai.attachment_id = a.id AND ara.user_id = ${me}))
  )`;
}

type CommonRow = {
  message_id: string | null;
  conversation_id: string | null;
  project_id: string | null;
  project_title: string | null;
  sender_id: string;
  sender_name: string;
  sender_role: Role;
  sender_company: string | null;
  other_name: string | null;
  other_role: Role | null;
  other_company: string | null;
};

/** Jointures communes : message visible, discussion dont l'admin est membre, expéditeur, interlocuteur. */
const FROM_MESSAGES = `
       JOIN conversations c ON c.id = m.conversation_id
       JOIN conversation_members me ON me.conversation_id = c.id AND me.user_id = $1
       JOIN users s ON s.id = m.sender_id
       LEFT JOIN projects p ON p.id = c.project_id
       LEFT JOIN LATERAL (
         SELECT u.full_name, u.role, u.company FROM conversation_members cm
           JOIN users u ON u.id = cm.user_id
          WHERE cm.conversation_id = c.id AND cm.user_id <> $1
          ORDER BY cm.joined_at LIMIT 1
       ) o ON true`;

const COMMON_COLUMNS = `
       m.id AS message_id, c.id AS conversation_id, c.project_id, p.title AS project_title,
       s.id AS sender_id, s.full_name AS sender_name, s.role AS sender_role, s.company AS sender_company,
       o.full_name AS other_name, o.role AS other_role, o.company AS other_company`;

/** Lien vers le message d'origine, dans l'espace de celui qui consulte. */
function sourceOf(r: CommonRow, space: Space): ResourceSource | null {
  if (!r.conversation_id || !r.message_id) return null;
  const anchor = `#msg-${r.message_id}`;
  if (r.project_id) {
    return {
      type: "projet",
      label: r.project_title ?? "Projet",
      href: space === "admin" ? `/admin/projets?p=${r.project_id}${anchor}` : `/user/messages?p=${r.project_id}${anchor}`,
    };
  }
  const label = r.other_name
    ? displayName({ name: r.other_name, role: r.other_role!, company: r.other_company })
    : "Discussion";
  const base = space === "admin" ? "/admin/messages" : "/user/messages";
  return { type: "discussion", label, href: `${base}?c=${r.conversation_id}${anchor}` };
}

const senderOf = (r: CommonRow, meId: string): Person =>
  r.sender_id
    ? { id: r.sender_id, name: r.sender_name, role: r.sender_role, company: r.sender_company, isMe: r.sender_id === meId }
    : { id: "", name: "Utilisateur supprimé", role: "utilisateur", company: null };

const KIND_BY_ATTACHMENT = { image: "photo", video: "video", audio: "audio", fichier: "document" } as const;

/** Fichiers joints aux messages (non supprimés) des discussions dont `viewer` est membre. */
export async function listFileResources(viewer: Viewer): Promise<FileResource[]> {
  const rows = await query<
    CommonRow & { id: string; file_name: string; mime_type: string; size_bytes: string; created_at: Date }
  >(
    `SELECT a.id, a.file_name, a.mime_type, a.size_bytes, a.created_at, ${COMMON_COLUMNS}
       FROM attachments a
       JOIN messages m ON m.id = a.message_id AND m.deleted_at IS NULL
       ${FROM_MESSAGES}
      ORDER BY a.created_at DESC
      LIMIT ${LIMIT}`,
    [viewer.id],
  );
  return rows.map((r) => ({
    kind: KIND_BY_ATTACHMENT[attachmentKind(r.mime_type)],
    id: r.id,
    name: r.file_name,
    mimeType: r.mime_type,
    size: Number(r.size_bytes),
    createdAt: r.created_at.toISOString(),
    sender: senderOf(r, viewer.id),
    source: sourceOf(r, viewer.space),
  }));
}

const URL_PATTERN = String.raw`(https?://[^\s<>"]+|www\.[^\s<>"]+)`;

/** Liens trouvés dans le texte des messages (non supprimés) des discussions dont `viewer` est membre. */
export async function listLinkResources(viewer: Viewer): Promise<LinkResource[]> {
  const rows = await query<CommonRow & { url: string; created_at: Date }>(
    `SELECT (regexp_matches(m.body, $2, 'gi'))[1] AS url, m.created_at, ${COMMON_COLUMNS}
       FROM messages m
       ${FROM_MESSAGES}
      WHERE m.deleted_at IS NULL AND m.body ~* '(https?://|www\\.)'
      ORDER BY m.created_at DESC
      LIMIT ${LIMIT}`,
    [viewer.id, URL_PATTERN],
  );

  const links: LinkResource[] = [];
  rows.forEach((r, i) => {
    const raw = r.url.replace(/[.,;:!?)\]'"]+$/, "");
    let url: URL;
    try {
      url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    } catch {
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    links.push({
      kind: "lien",
      id: `${r.message_id}-${i}`,
      url: url.toString(),
      host: url.hostname.replace(/^www\./, ""),
      createdAt: r.created_at.toISOString(),
      sender: senderOf(r, viewer.id),
      source: sourceOf(r, viewer.space),
      messageId: r.message_id ?? undefined,
    });
  });
  return links;
}

/* ------------------------------------------------------------------ */
/* Dossiers                                                            */
/* ------------------------------------------------------------------ */

export type FolderSummary = {
  id: string;
  name: string;
  count: number;
  updatedAt: string;
  /** Jusqu'à 4 photos du dossier, pour l'aperçu de la carte. */
  previews: string[];
};

/**
 * Éléments visibles d'un dossier pour son propriétaire `me` : les liens, et les fichiers
 * qu'il peut encore consulter (message non supprimé, toujours membre de la discussion…).
 */
const visibleItem = (me: string) => `
  (i.link_url IS NOT NULL
   OR EXISTS (SELECT 1 FROM attachments a
               LEFT JOIN messages m ON m.id = a.message_id
              WHERE a.id = i.attachment_id AND ${canAccessAttachment(me)}))`;

/** Dossiers créés par `ownerId` : chaque compte ne voit que les siens. */
export async function listFolders(ownerId: string): Promise<FolderSummary[]> {
  const rows = await query<{ id: string; name: string; updated_at: Date; count: number; previews: string[] | null }>(
    `SELECT f.id, f.name, f.updated_at,
            (SELECT count(*)::int FROM resource_folder_items i WHERE i.folder_id = f.id AND ${visibleItem("$1")}) AS count,
            (SELECT array_agg(x.id) FROM (
               SELECT a.id FROM resource_folder_items i
                 JOIN attachments a ON a.id = i.attachment_id
                WHERE i.folder_id = f.id AND ${visibleItem("$1")}
                  AND a.mime_type IN ('image/jpeg','image/png','image/gif','image/webp','image/avif')
                ORDER BY i.added_at DESC LIMIT 4) x) AS previews
       FROM resource_folders f
      WHERE f.created_by = $1
      ORDER BY f.updated_at DESC`,
    [ownerId],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    count: r.count,
    updatedAt: r.updated_at.toISOString(),
    previews: r.previews ?? [],
  }));
}

/** Interlocuteur d'une discussion (pour nommer la source), relatif au compte $2. */
const OTHER_MEMBER = `
       LEFT JOIN LATERAL (
         SELECT u.full_name, u.role, u.company FROM conversation_members cm
           JOIN users u ON u.id = cm.user_id
          WHERE cm.conversation_id = c.id AND cm.user_id <> $2
          ORDER BY cm.joined_at LIMIT 1
       ) o ON true`;

const SOURCE_COLUMNS = `
       c.project_id, p.title AS project_title,
       s.id AS sender_id, s.full_name AS sender_name, s.role AS sender_role, s.company AS sender_company,
       o.full_name AS other_name, o.role AS other_role, o.company AS other_company`;

/** Dossier de `viewer` avec son contenu, ou `null` s'il n'existe pas ou appartient à un autre compte. */
export async function getFolder(folderId: string, viewer: Viewer) {
  const [folder] = await query<{ id: string; name: string; updated_at: Date }>(
    "SELECT id, name, updated_at FROM resource_folders WHERE id = $1 AND created_by = $2",
    [folderId, viewer.id],
  );
  if (!folder) return null;

  const [fileRows, linkRows] = await Promise.all([
    query<CommonRow & {
      item_id: string;
      access: AccessUser[];
      added_at: Date;
      id: string;
      file_name: string;
      mime_type: string;
      size_bytes: string;
    }>(
      `SELECT i.id AS item_id, i.added_at, a.id, a.file_name, a.mime_type, a.size_bytes, ${ACCESS_COLUMN},
              a.message_id, a.conversation_id, ${SOURCE_COLUMNS}
         FROM resource_folder_items i
         JOIN attachments a ON a.id = i.attachment_id
         LEFT JOIN messages m ON m.id = a.message_id
         LEFT JOIN conversations c ON c.id = a.conversation_id
         LEFT JOIN projects p ON p.id = c.project_id
         LEFT JOIN users s ON s.id = COALESCE(m.sender_id, a.uploaded_by)
         ${OTHER_MEMBER}
        WHERE i.folder_id = $1 AND ${canAccessAttachment("$2")}
        ORDER BY i.added_at DESC`,
      [folderId, viewer.id],
    ),
    query<CommonRow & { item_id: string; added_at: Date; link_url: string; link_title: string | null; access: AccessUser[] }>(
      `SELECT i.id AS item_id, i.added_at, i.link_url, i.link_title, ${ACCESS_COLUMN},
              m.id AS message_id, c.id AS conversation_id, ${SOURCE_COLUMNS}
         FROM resource_folder_items i
         LEFT JOIN messages m ON m.id = i.source_message_id AND m.deleted_at IS NULL
         LEFT JOIN conversations c ON c.id = m.conversation_id
         LEFT JOIN projects p ON p.id = c.project_id
         LEFT JOIN users s ON s.id = COALESCE(m.sender_id, i.added_by)
         ${OTHER_MEMBER}
        WHERE i.folder_id = $1 AND i.link_url IS NOT NULL
        ORDER BY i.added_at DESC`,
      [folderId, viewer.id],
    ),
  ]);

  const files: FileResource[] = fileRows.map((r) => ({
    kind: KIND_BY_ATTACHMENT[attachmentKind(r.mime_type)],
    id: r.id,
    itemId: r.item_id,
    access: r.access,
    name: r.file_name,
    mimeType: r.mime_type,
    size: Number(r.size_bytes),
    createdAt: r.added_at.toISOString(),
    sender: senderOf(r, viewer.id),
    source: sourceOf(r, viewer.space),
  }));

  const links: LinkResource[] = linkRows.map((r) => {
    let host = r.link_url;
    try {
      host = new URL(r.link_url).hostname.replace(/^www\./, "");
    } catch {}
    return {
      kind: "lien",
      id: r.item_id,
      itemId: r.item_id,
      access: r.access,
      url: r.link_url,
      host,
      title: r.link_title,
      createdAt: r.added_at.toISOString(),
      sender: senderOf(r, viewer.id),
      source: sourceOf(r, viewer.space),
    };
  });

  return { id: folder.id, name: folder.name, updatedAt: folder.updated_at.toISOString(), files, links };
}

/** Colonne JSON des utilisateurs autorisés pour l'élément de dossier `i`. */
const ACCESS_COLUMN = `
       COALESCE((SELECT json_agg(json_build_object(
                  'id', u.id, 'name', u.full_name, 'role', u.role,
                  'company', u.company, 'status', u.status) ORDER BY u.full_name)
                   FROM resource_item_access ra JOIN users u ON u.id = ra.user_id
                  WHERE ra.item_id = i.id), '[]') AS access`;

type GranterRow = {
  granter_id: string | null;
  granter_name: string | null;
  granter_role: Role | null;
  granter_company: string | null;
};

/** Personne qui a partagé l'élément (l'admin) ; l'expéditeur d'origine n'est jamais révélé. */
const granterOf = (r: GranterRow): Person =>
  r.granter_id
    ? { id: r.granter_id, name: r.granter_name!, role: r.granter_role!, company: r.granter_company }
    : { id: "", name: "Administration", role: "admin", company: null };

const GRANTER_COLUMNS = `
       g.id AS granter_id, g.full_name AS granter_name, g.role AS granter_role, g.company AS granter_company`;

/**
 * Fichiers et liens que l'admin a partagés avec `viewer` (resource_item_access).
 * Sans lien vers la discussion d'origine : elle peut appartenir à un autre utilisateur.
 */
export async function listSharedWithMe(viewer: Viewer): Promise<{ files: FileResource[]; links: LinkResource[] }> {
  const [fileRows, linkRows] = await Promise.all([
    query<GranterRow & { granted_at: Date; id: string; file_name: string; mime_type: string; size_bytes: string }>(
      `SELECT DISTINCT ON (a.id) ra.granted_at, a.id, a.file_name, a.mime_type, a.size_bytes, ${GRANTER_COLUMNS}
         FROM resource_item_access ra
         JOIN resource_folder_items i ON i.id = ra.item_id
         JOIN attachments a ON a.id = i.attachment_id
         LEFT JOIN messages m ON m.id = a.message_id
         LEFT JOIN users g ON g.id = ra.granted_by
        WHERE ra.user_id = $1 AND (a.message_id IS NULL OR m.deleted_at IS NULL)
        ORDER BY a.id, ra.granted_at DESC
        LIMIT ${LIMIT}`,
      [viewer.id],
    ),
    query<GranterRow & { granted_at: Date; item_id: string; link_url: string; link_title: string | null }>(
      `SELECT DISTINCT ON (i.link_url) ra.granted_at, i.id AS item_id, i.link_url, i.link_title, ${GRANTER_COLUMNS}
         FROM resource_item_access ra
         JOIN resource_folder_items i ON i.id = ra.item_id AND i.link_url IS NOT NULL
         LEFT JOIN users g ON g.id = ra.granted_by
        WHERE ra.user_id = $1
        ORDER BY i.link_url, ra.granted_at DESC
        LIMIT ${LIMIT}`,
      [viewer.id],
    ),
  ]);

  const byDate = <T extends { createdAt: string }>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt);

  const files: FileResource[] = fileRows
    .map((r) => {
      const sender = granterOf(r);
      return {
        kind: KIND_BY_ATTACHMENT[attachmentKind(r.mime_type)],
        id: r.id,
        name: r.file_name,
        mimeType: r.mime_type,
        size: Number(r.size_bytes),
        createdAt: r.granted_at.toISOString(),
        sender,
        source: null,
        sharedBy: displayName(sender),
      };
    })
    .sort(byDate);

  const links: LinkResource[] = linkRows
    .map((r) => {
      let host = r.link_url;
      try {
        host = new URL(r.link_url).hostname.replace(/^www\./, "");
      } catch {}
      const sender = granterOf(r);
      return {
        kind: "lien" as const,
        id: r.item_id,
        url: r.link_url,
        host,
        title: r.link_title,
        createdAt: r.granted_at.toISOString(),
        sender,
        source: null,
        sharedBy: displayName(sender),
      };
    })
    .sort(byDate);

  return { files, links };
}

/** Utilisateurs (hors admin) à qui l'on peut donner l'accès à une ressource. */
export async function listShareableUsers(): Promise<AccessUser[]> {
  const rows = await query<{ id: string; full_name: string; role: Role; company: string | null; status: Status }>(
    "SELECT id, full_name, role, company, status FROM users WHERE role <> 'admin' ORDER BY full_name",
  );
  return rows.map((r) => ({ id: r.id, name: r.full_name, role: r.role, company: r.company, status: r.status }));
}
