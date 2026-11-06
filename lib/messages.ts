import "server-only";
import { pool, query } from "./db";
import type {
  AdminUser,
  Contact,
  ConversationSummary,
  Message,
  MessageAttachment,
  MessageReaction,
  ProjectStatus,
  Role,
  Status,
} from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_RE.test(value);

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/**
 * Compte administrateur de l'application : l'interlocuteur des utilisateurs dans leur espace
 * (discussion directe, discussions de projet). L'admin connecté, lui, vient de la session (lib/auth).
 */
export async function getAdminAccount(): Promise<AdminUser> {
  const email = process.env.ADMIN_EMAIL ?? "admin@twinslack.app";
  // Compte admin désigné par ADMIN_EMAIL en priorité ; sinon le premier admin
  // (l'admin peut ainsi changer son e-mail depuis son profil).
  const [row] = await query<{
    id: string;
    full_name: string;
    email: string;
    avatar_key: string | null;
    avatar_updated_at: Date | null;
  }>(
    `SELECT id, full_name, email, avatar_key, avatar_updated_at FROM users
      WHERE role = 'admin'
      ORDER BY (email = $1) DESC, created_at
      LIMIT 1`,
    [email],
  );
  if (!row) {
    throw new Error(`Aucun compte admin trouvé. Lancez "npm run db:seed".`);
  }
  return {
    id: row.id,
    name: row.full_name,
    email: row.email,
    avatarUrl: avatarUrl(row.id, row.avatar_key, row.avatar_updated_at),
  };
}

/** Adresse de la photo de profil (versionnée pour éviter le cache), ou `null`. */
export function avatarUrl(userId: string, key: string | null, updatedAt: Date | null) {
  return key ? `/api/avatars/${userId}?v=${updatedAt?.getTime() ?? 0}` : null;
}

type SummaryRow = {
  id: string;
  other_id: string;
  other_name: string;
  other_email: string;
  other_role: Role;
  other_company: string | null;
  other_status: Status;
  other_last_seen: Date | null;
  other_avatar_key: string | null;
  other_avatar_updated: Date | null;
  project_id: string | null;
  project_title: string | null;
  project_status: ProjectStatus | null;
  project_owner: string | null;
  last_body: string | null;
  last_at: Date | null;
  last_from_me: boolean | null;
  last_deleted: boolean | null;
  unread: number;
  other_last_read: Date | null;
};

const SUMMARY_SQL = `
  SELECT c.id,
         o.id AS other_id, o.full_name AS other_name, o.email AS other_email,
         o.role AS other_role, o.company AS other_company,
         o.status AS other_status, o.last_seen_at AS other_last_seen,
         o.avatar_key AS other_avatar_key, o.avatar_updated_at AS other_avatar_updated,
         o.member_last_read AS other_last_read,
         c.project_id, pr.title AS project_title, pr.status AS project_status, pr.owner_id AS project_owner,
         lm.body AS last_body, lm.created_at AS last_at,
         lm.sender_id = $1 AS last_from_me, lm.deleted_at IS NOT NULL AS last_deleted,
         (SELECT count(*)::int FROM messages m
           WHERE m.conversation_id = c.id AND m.sender_id <> $1
             AND m.deleted_at IS NULL AND m.created_at > me.last_read_at) AS unread
    FROM conversations c
    JOIN conversation_members me ON me.conversation_id = c.id AND me.user_id = $1
    LEFT JOIN projects pr ON pr.id = c.project_id
    -- Interlocuteur : le premier autre membre arrivé (l'admin passe avant les autres à égalité).
    JOIN LATERAL (
      SELECT u.*, cm.last_read_at AS member_last_read FROM conversation_members cm JOIN users u ON u.id = cm.user_id
       WHERE cm.conversation_id = c.id AND cm.user_id <> $1
       ORDER BY cm.joined_at, (u.role = 'admin') DESC LIMIT 1
    ) o ON true
    LEFT JOIN LATERAL (
      SELECT * FROM messages m WHERE m.conversation_id = c.id
       ORDER BY m.created_at DESC LIMIT 1
    ) lm ON true
`;

function toSummary(r: SummaryRow): ConversationSummary {
  const contact: Contact = {
    id: r.other_id,
    name: r.other_name,
    email: r.other_email,
    role: r.other_role,
    company: r.other_company,
    status: r.other_status,
    lastSeenAt: iso(r.other_last_seen),
    avatarUrl: avatarUrl(r.other_id, r.other_avatar_key, r.other_avatar_updated),
  };
  return {
    id: r.id,
    contact,
    project:
      r.project_id && r.project_title && r.project_status && r.project_owner
        ? { id: r.project_id, title: r.project_title, status: r.project_status, ownerId: r.project_owner }
        : null,
    lastMessage: r.last_at
      ? {
          body: r.last_body || "Pièce jointe",
          at: r.last_at.toISOString(),
          fromMe: Boolean(r.last_from_me),
          deleted: Boolean(r.last_deleted),
        }
      : null,
    unread: r.unread,
    contactLastReadAt: iso(r.other_last_read),
  };
}

export async function listConversations(adminId: string): Promise<ConversationSummary[]> {
  const rows = await query<SummaryRow>(
    `${SUMMARY_SQL} WHERE c.project_id IS NULL ORDER BY COALESCE(lm.created_at, c.updated_at) DESC`,
    [adminId],
  );
  return rows.map(toSummary);
}

export async function getConversation(
  adminId: string,
  conversationId: string,
): Promise<ConversationSummary | null> {
  if (!isUuid(conversationId)) return null;
  const [row] = await query<SummaryRow>(`${SUMMARY_SQL} WHERE c.id = $2`, [
    adminId,
    conversationId,
  ]);
  return row ? toSummary(row) : null;
}

/** Les 200 derniers messages, du plus ancien au plus récent. */
export async function listMessages(conversationId: string): Promise<Message[]> {
  const rows = await query<{
    id: string;
    body: string;
    sender_id: string;
    sender_name: string;
    sender_avatar_key: string | null;
    sender_avatar_updated: Date | null;
    pinned: boolean;
    created_at: Date;
    edited_at: Date | null;
    deleted_at: Date | null;
    attachments: MessageAttachment[];
    reactions: MessageReaction[];
  }>(
    `SELECT * FROM (
       SELECT m.id, m.body, m.sender_id, u.full_name AS sender_name,
              u.avatar_key AS sender_avatar_key, u.avatar_updated_at AS sender_avatar_updated, m.pinned,
              m.created_at, m.edited_at, m.deleted_at,
              COALESCE((SELECT json_agg(json_build_object(
                         'id', a.id, 'name', a.file_name,
                         'mimeType', a.mime_type, 'size', a.size_bytes) ORDER BY a.created_at)
                         FROM attachments a WHERE a.message_id = m.id), '[]') AS attachments,
              -- Réactions regroupées par emoji, dans l'ordre de la première réaction
              COALESCE((SELECT json_agg(json_build_object('emoji', g.emoji, 'userIds', g.user_ids, 'names', g.names)
                                        ORDER BY g.first_at)
                          FROM (SELECT r.emoji, min(r.created_at) AS first_at,
                                       json_agg(r.user_id ORDER BY r.created_at) AS user_ids,
                                       json_agg(ru.full_name ORDER BY r.created_at) AS names
                                  FROM message_reactions r JOIN users ru ON ru.id = r.user_id
                                 WHERE r.message_id = m.id
                                 GROUP BY r.emoji) g), '[]') AS reactions
         FROM messages m JOIN users u ON u.id = m.sender_id
        WHERE m.conversation_id = $1
        ORDER BY m.created_at DESC LIMIT 200
     ) t ORDER BY created_at ASC`,
    [conversationId],
  );
  return rows.map((r) => ({
    id: r.id,
    body: r.deleted_at ? "" : r.body,
    senderId: r.sender_id,
    senderName: r.sender_name,
    senderAvatarUrl: avatarUrl(r.sender_id, r.sender_avatar_key, r.sender_avatar_updated),
    pinned: r.pinned,
    createdAt: r.created_at.toISOString(),
    editedAt: iso(r.edited_at),
    deleted: r.deleted_at !== null,
    attachments: r.deleted_at ? [] : r.attachments,
    reactions: r.deleted_at ? [] : r.reactions,
  }));
}

/** Toutes les discussions d'un utilisateur : avec l'admin, et celles des projets dont il est membre. */
export async function listMemberConversations(userId: string): Promise<ConversationSummary[]> {
  const rows = await query<SummaryRow>(
    `${SUMMARY_SQL} ORDER BY COALESCE(lm.created_at, c.updated_at) DESC`,
    [userId],
  );
  return rows.map(toSummary);
}

const FIND_DIRECT_SQL = `
  SELECT c.id FROM conversations c
    JOIN conversation_members a ON a.conversation_id = c.id AND a.user_id = $1
    JOIN conversation_members b ON b.conversation_id = c.id AND b.user_id = $2
   WHERE c.kind = 'direct' AND c.project_id IS NULL
   ORDER BY c.created_at LIMIT 1`;

/**
 * Discussion directe entre un utilisateur et l'admin, créée si besoin.
 * Lecture simple d'abord (cas courant, à chaque affichage) ; la création se fait sous
 * verrou transactionnel par utilisateur : deux requêtes simultanées n'en créent pas deux.
 */
export async function ensureDirectConversation(userId: string, adminId: string): Promise<string> {
  const [found] = await query<{ id: string }>(FIND_DIRECT_SQL, [userId, adminId]);
  if (found) return found.id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`direct:${userId}`]);
    const { rows: [existing] } = await client.query<{ id: string }>(FIND_DIRECT_SQL, [userId, adminId]);
    if (existing) {
      await client.query("COMMIT");
      return existing.id;
    }
    const { rows: [created] } = await client.query<{ id: string }>(
      "INSERT INTO conversations (kind) VALUES ('direct') RETURNING id",
    );
    await client.query(
      `INSERT INTO conversation_members (conversation_id, user_id, last_read_at)
       VALUES ($1, $2, now()), ($1, $3, now())`,
      [created.id, adminId, userId],
    );
    await client.query("COMMIT");
    return created.id;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function isMember(userId: string, conversationId: string) {
  if (!isUuid(conversationId)) return false;
  const rows = await query(
    "SELECT 1 FROM conversation_members WHERE user_id = $1 AND conversation_id = $2",
    [userId, conversationId],
  );
  return rows.length > 0;
}
