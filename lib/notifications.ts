import "server-only";
import { query } from "./db";
import type { NotificationFeed, NotificationKind, NotificationPrefs, Role } from "./types";

export const DEFAULT_PREFS: NotificationPrefs = {
  messages: true,
  inscriptions: true,
  projets: true,
  ressources: true,
  navigateur: false,
};

/** Date de dernière ouverture du panneau et préférences du compte. */
async function readSettings(userId: string) {
  const [me] = await query<{ seen: Date; prefs: Partial<NotificationPrefs> | null }>(
    "SELECT notifications_seen_at AS seen, notification_prefs AS prefs FROM users WHERE id = $1",
    [userId],
  );
  const prefs: NotificationPrefs = { ...DEFAULT_PREFS, ...(me?.prefs ?? {}) };
  return { prefs, seen: me?.seen ?? new Date(0) };
}

const FEED_LIMIT = 40;

type Row = {
  kind: NotificationKind;
  key: string;
  at: Date;
  actor_id: string;
  actor_name: string;
  actor_role: Role;
  actor_company: string | null;
  detail: string | null;
  conversation_id: string | null;
  project_id: string | null;
};

/** Page vers laquelle mène une notification. */
function hrefFor(r: Row) {
  if (r.kind === "message") {
    if (r.project_id) return `/admin/projets?p=${r.project_id}`;
    if (r.conversation_id) return `/admin/messages?c=${r.conversation_id}`;
  }
  if (r.kind === "projet" || r.kind === "projet_termine") {
    return `/admin/projets?p=${r.key.split(":")[0]}`;
  }
  if (r.kind === "partage") return "/admin/ressources?type=partages";
  return `/admin/utilisateurs/${r.actor_id}`;
}

/**
 * Flux de notifications de l'admin, construit à partir des données existantes
 * (30 derniers jours). Une notification est « non lue » si elle est plus récente
 * que la dernière ouverture du panneau.
 */
export async function getNotificationFeed(adminId: string): Promise<NotificationFeed> {
  const { prefs, seen } = await readSettings(adminId);

  const rows = await query<Row>(
    `SELECT * FROM (
       -- Dernier message reçu dans chaque discussion
       (SELECT DISTINCT ON (m.conversation_id)
               'message' AS kind, m.id::text AS key, m.created_at AS at,
               u.id AS actor_id, u.full_name AS actor_name, u.role AS actor_role,
               u.company AS actor_company, COALESCE(NULLIF(m.body, ''), 'Pièce jointe') AS detail, m.conversation_id,
               cv.project_id
          FROM messages m
          JOIN conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = $1
          JOIN users u ON u.id = m.sender_id
          JOIN conversations cv ON cv.id = m.conversation_id
         WHERE $2::bool AND m.sender_id <> $1 AND m.deleted_at IS NULL
           AND m.created_at > now() - interval '30 days'
         ORDER BY m.conversation_id, m.created_at DESC)
       UNION ALL
       -- Nouvelles inscriptions
       SELECT 'inscription', u.id::text, u.created_at, u.id, u.full_name, u.role, u.company, NULL, NULL, NULL
         FROM users u
        WHERE $3::bool AND u.role <> 'admin' AND u.created_at > now() - interval '30 days'
       UNION ALL
       -- Projets proposés
       SELECT 'projet', p.id::text, p.created_at, u.id, u.full_name, u.role, u.company, p.title, NULL, NULL
         FROM projects p JOIN users u ON u.id = p.owner_id
        WHERE $4::bool AND p.created_at > now() - interval '30 days'
       UNION ALL
       -- Projets terminés
       SELECT 'projet_termine', p.id::text || ':termine', p.completed_at, u.id, u.full_name, u.role, u.company, p.title, NULL, NULL
         FROM projects p JOIN users u ON u.id = p.owner_id
        WHERE $4::bool AND p.completed_at IS NOT NULL AND p.completed_at > now() - interval '30 days'
       UNION ALL
       -- Ressources qu'un utilisateur autorise l'administration à voir
       SELECT 'partage', ra.item_id::text, ra.granted_at, u.id, u.full_name, u.role, u.company,
              COALESCE(a.file_name, i.link_title, i.link_url), NULL, NULL
         FROM resource_item_access ra
         JOIN resource_folder_items i ON i.id = ra.item_id
         LEFT JOIN attachments a ON a.id = i.attachment_id
         JOIN users u ON u.id = ra.granted_by
        WHERE $5::bool AND ra.user_id = $1 AND ra.granted_at > now() - interval '30 days'
     ) feed
     ORDER BY at DESC
     LIMIT ${FEED_LIMIT}`,
    [adminId, prefs.messages, prefs.inscriptions, prefs.projets, prefs.ressources],
  );

  return toFeed(rows, seen, prefs, hrefFor);
}

function toFeed(rows: Row[], seen: Date, prefs: NotificationPrefs, href: (r: Row) => string): NotificationFeed {
  const items = rows.map((r) => ({
    id: `${r.kind}:${r.key}`,
    kind: r.kind,
    at: r.at.toISOString(),
    unread: r.at > seen,
    actor: { id: r.actor_id, name: r.actor_name, role: r.actor_role, company: r.actor_company },
    detail: r.detail,
    href: href(r),
  }));
  return { items, unreadCount: items.filter((i) => i.unread).length, prefs };
}

/** Page de l'espace utilisateur vers laquelle mène une notification. */
function memberHrefFor(r: Row) {
  switch (r.kind) {
    case "message":
      return r.project_id ? `/user/messages?p=${r.project_id}` : `/user/messages?c=${r.conversation_id}`;
    case "ajout_discussion":
      return `/user/messages?p=${r.project_id}`;
    case "mon_projet_termine":
    case "mon_projet_paye":
      return `/user/projets#projet-${r.project_id}`;
    default:
      return "/user/ressources?type=partages";
  }
}

/**
 * Flux de notifications d'un utilisateur (30 derniers jours) : messages reçus,
 * avancement de ses projets (terminé, payé), ajout à la discussion d'un projet
 * et ressources partagées avec lui. Les événements de projet viennent de l'admin `adminId`.
 */
export async function getMemberNotificationFeed(userId: string, adminId: string): Promise<NotificationFeed> {
  const { prefs, seen } = await readSettings(userId);

  const rows = await query<Row>(
    `WITH adm AS (SELECT id, full_name, role, company FROM users WHERE id = $5)
     SELECT * FROM (
       -- Dernier message reçu dans chaque discussion
       (SELECT DISTINCT ON (m.conversation_id)
               'message' AS kind, m.id::text AS key, m.created_at AS at,
               u.id AS actor_id, u.full_name AS actor_name, u.role AS actor_role,
               u.company AS actor_company, COALESCE(NULLIF(m.body, ''), 'Pièce jointe') AS detail, m.conversation_id,
               cv.project_id
          FROM messages m
          JOIN conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = $1
          JOIN users u ON u.id = m.sender_id
          JOIN conversations cv ON cv.id = m.conversation_id
         WHERE $2::bool AND m.sender_id <> $1 AND m.deleted_at IS NULL
           AND m.created_at > now() - interval '30 days'
         ORDER BY m.conversation_id, m.created_at DESC)
       UNION ALL
       -- Mes projets terminés
       SELECT 'mon_projet_termine', p.id::text || ':termine', p.completed_at,
              adm.id, adm.full_name, adm.role, adm.company, p.title, NULL, p.id
         FROM projects p CROSS JOIN adm
        WHERE $3::bool AND p.owner_id = $1 AND p.completed_at > now() - interval '30 days'
       UNION ALL
       -- Mes projets payés
       SELECT 'mon_projet_paye', p.id::text || ':paye', p.paid_at,
              adm.id, adm.full_name, adm.role, adm.company, p.title, NULL, p.id
         FROM projects p CROSS JOIN adm
        WHERE $3::bool AND p.owner_id = $1 AND p.paid_at > now() - interval '30 days'
       UNION ALL
       -- Ajouté à la discussion du projet d'une autre personne
       SELECT 'ajout_discussion', cv.id::text, cm.joined_at,
              adm.id, adm.full_name, adm.role, adm.company, p.title, cv.id, p.id
         FROM conversation_members cm
         JOIN conversations cv ON cv.id = cm.conversation_id
         JOIN projects p ON p.id = cv.project_id
         CROSS JOIN adm
        WHERE $3::bool AND cm.user_id = $1 AND p.owner_id <> $1
          AND cm.joined_at > now() - interval '30 days'
       UNION ALL
       -- Ressources partagées avec moi
       SELECT 'partage', ra.item_id::text, ra.granted_at,
              adm.id, adm.full_name, adm.role, adm.company,
              COALESCE(a.file_name, i.link_title, i.link_url), NULL, NULL
         FROM resource_item_access ra
         JOIN resource_folder_items i ON i.id = ra.item_id
         LEFT JOIN attachments a ON a.id = i.attachment_id
         CROSS JOIN adm
        WHERE $4::bool AND ra.user_id = $1 AND ra.granted_at > now() - interval '30 days'
     ) feed
     ORDER BY at DESC
     LIMIT ${FEED_LIMIT}`,
    [userId, prefs.messages, prefs.projets, prefs.ressources, adminId],
  );

  return toFeed(rows, seen, prefs, memberHrefFor);
}
