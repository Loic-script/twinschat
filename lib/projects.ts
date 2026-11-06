import "server-only";
import { pool, query } from "./db";
import { avatarUrl, isUuid } from "./messages";
import type { Project, ProjectStatus, Role, Status } from "./types";

export type ProjectOwner = {
  id: string;
  name: string;
  role: Role;
  company: string | null;
  jobTitle: string | null;
  workplace: string | null;
  status: Status;
};

export type ProjectListItem = {
  id: string;
  title: string;
  category: string | null;
  status: ProjectStatus;
  /** Messages de l'auteur non lus par l'admin dans la discussion du projet. */
  unread: number;
  /** Dernière activité : dernier message, sinon date de proposition. */
  lastActivityAt: string;
};

export type OwnerWithProjects = ProjectOwner & {
  projects: ProjectListItem[];
  unread: number;
  lastActivityAt: string;
};

export type ProjectWithOwner = Project & { owner: ProjectOwner };

/** Toutes les personnes ayant proposé au moins un projet, avec leurs projets. */
export async function listProjectOwners(adminId: string): Promise<OwnerWithProjects[]> {
  const rows = await query<{
    id: string;
    title: string;
    category: string | null;
    status: ProjectStatus;
    created_at: Date;
    owner_id: string;
    full_name: string;
    role: Role;
    company: string | null;
    job_title: string | null;
    workplace: string | null;
    presence: Status;
    unread: number;
    last_message_at: Date | null;
  }>(
    `SELECT p.id, p.title, p.category, p.status, p.created_at,
            u.id AS owner_id, u.full_name, u.role, u.company, u.job_title, u.workplace,
            u.status AS presence,
            COALESCE((SELECT count(*)::int FROM messages m
                       WHERE m.conversation_id = c.id AND m.sender_id <> $1
                         AND m.deleted_at IS NULL AND m.created_at > cm.last_read_at), 0) AS unread,
            (SELECT max(m.created_at) FROM messages m WHERE m.conversation_id = c.id) AS last_message_at
       FROM projects p
       JOIN users u ON u.id = p.owner_id
       LEFT JOIN conversations c ON c.project_id = p.id
       LEFT JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = $1
      ORDER BY (p.status = 'termine'), COALESCE(
        (SELECT max(m.created_at) FROM messages m WHERE m.conversation_id = c.id), p.created_at) DESC`,
    [adminId],
  );

  const owners = new Map<string, OwnerWithProjects>();
  for (const r of rows) {
    const lastActivityAt = (r.last_message_at ?? r.created_at).toISOString();
    let owner = owners.get(r.owner_id);
    if (!owner) {
      owner = {
        id: r.owner_id,
        name: r.full_name,
        role: r.role,
        company: r.company,
        jobTitle: r.job_title,
        workplace: r.workplace,
        status: r.presence,
        projects: [],
        unread: 0,
        lastActivityAt,
      };
      owners.set(r.owner_id, owner);
    }
    owner.projects.push({
      id: r.id,
      title: r.title,
      category: r.category,
      status: r.status,
      unread: r.unread,
      lastActivityAt,
    });
    owner.unread += r.unread;
    if (lastActivityAt > owner.lastActivityAt) owner.lastActivityAt = lastActivityAt;
  }

  // Les personnes avec des messages non lus d'abord, puis la plus récente activité.
  return [...owners.values()].sort(
    (a, b) => Number(b.unread > 0) - Number(a.unread > 0) || b.lastActivityAt.localeCompare(a.lastActivityAt),
  );
}

export async function getProjectWithOwner(projectId: string): Promise<ProjectWithOwner | null> {
  if (!isUuid(projectId)) return null;
  const [r] = await query<{
    id: string;
    title: string;
    category: string | null;
    description: string | null;
    status: ProjectStatus;
    created_at: Date;
    completed_at: Date | null;
    paid_at: Date | null;
    url: string | null;
    owner_id: string;
    full_name: string;
    role: Role;
    company: string | null;
    job_title: string | null;
    workplace: string | null;
    presence: Status;
  }>(
    `SELECT p.id, p.title, p.category, p.description, p.status, p.created_at, p.completed_at, p.paid_at, p.url,
            u.id AS owner_id, u.full_name, u.role, u.company, u.job_title, u.workplace, u.status AS presence
       FROM projects p JOIN users u ON u.id = p.owner_id
      WHERE p.id = $1`,
    [projectId],
  );
  if (!r) return null;
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    description: r.description,
    status: r.status,
    createdAt: r.created_at.toISOString(),
    completedAt: r.completed_at?.toISOString() ?? null,
    paidAt: r.paid_at?.toISOString() ?? null,
    url: r.url,
    owner: {
      id: r.owner_id,
      name: r.full_name,
      role: r.role,
      company: r.company,
      jobTitle: r.job_title,
      workplace: r.workplace,
      status: r.presence,
    },
  };
}

/**
 * Retourne la discussion du projet (admin ↔ auteur), en la créant au premier accès.
 * Idempotent grâce à l'index unique sur conversations.project_id.
 */
export async function ensureProjectConversation(projectId: string, ownerId: string, adminId: string) {
  const [existing] = await query<{ id: string }>(
    "SELECT id FROM conversations WHERE project_id = $1",
    [projectId],
  );
  if (existing) return existing.id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [created] } = await client.query<{ id: string }>(
      `INSERT INTO conversations (kind, project_id) VALUES ('projet', $1)
       ON CONFLICT (project_id) WHERE project_id IS NOT NULL DO NOTHING
       RETURNING id`,
      [projectId],
    );
    if (!created) {
      // Créée entre-temps par une autre requête.
      await client.query("ROLLBACK");
      const [row] = await query<{ id: string }>("SELECT id FROM conversations WHERE project_id = $1", [projectId]);
      return row.id;
    }
    await client.query(
      `INSERT INTO conversation_members (conversation_id, user_id, last_read_at)
       VALUES ($1, $2, now()), ($1, $3, 'epoch')`,
      [created.id, adminId, ownerId],
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

export type Participant = {
  id: string;
  name: string;
  role: Role;
  company: string | null;
  status: Status;
};

/* ------------------------------------------------------------------ */
/* Espace utilisateur                                                  */
/* ------------------------------------------------------------------ */

export type MemberProject = Project & {
  /** Messages non lus dans la discussion du projet. */
  unread: number;
  /** Dernier message de la discussion, s'il y en a un. */
  lastMessageAt: string | null;
};

/** Projets proposés par l'utilisateur, du plus récent au plus ancien. */
export async function listMemberProjects(userId: string): Promise<MemberProject[]> {
  const rows = await query<{
    id: string;
    title: string;
    category: string | null;
    description: string | null;
    status: ProjectStatus;
    created_at: Date;
    completed_at: Date | null;
    paid_at: Date | null;
    url: string | null;
    unread: number;
    last_message_at: Date | null;
  }>(
    `SELECT p.id, p.title, p.category, p.description, p.status, p.created_at, p.completed_at, p.paid_at, p.url,
            COALESCE((SELECT count(*)::int FROM messages m
                       WHERE m.conversation_id = c.id AND m.sender_id <> $1
                         AND m.deleted_at IS NULL AND m.created_at > cm.last_read_at), 0) AS unread,
            (SELECT max(m.created_at) FROM messages m
              WHERE m.conversation_id = c.id AND m.deleted_at IS NULL) AS last_message_at
       FROM projects p
       LEFT JOIN conversations c ON c.project_id = p.id
       LEFT JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = $1
      WHERE p.owner_id = $1
      ORDER BY p.created_at DESC`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    description: r.description,
    status: r.status,
    createdAt: r.created_at.toISOString(),
    completedAt: r.completed_at?.toISOString() ?? null,
    paidAt: r.paid_at?.toISOString() ?? null,
    url: r.url,
    unread: r.unread,
    lastMessageAt: r.last_message_at?.toISOString() ?? null,
  }));
}

/**
 * Projet accessible à l'utilisateur : le sien, ou un projet dont il a rejoint
 * la discussion (ajouté par l'admin). Sinon `null`.
 */
export async function getMemberProject(projectId: string, userId: string): Promise<ProjectWithOwner | null> {
  const project = await getProjectWithOwner(projectId);
  if (!project) return null;
  if (project.owner.id === userId) return project;
  const rows = await query(
    `SELECT 1 FROM conversations c
       JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = $2
      WHERE c.project_id = $1`,
    [projectId, userId],
  );
  return rows.length > 0 ? project : null;
}

/* ------------------------------------------------------------------ */
/* Statistiques (admin)                                                */
/* ------------------------------------------------------------------ */

export type ProjectWithAuthor = Project & {
  owner: { id: string; name: string; role: Role; company: string | null; avatarUrl: string | null };
};

/** Tous les projets avec leur auteur, du plus récent au plus ancien. */
export async function listAllProjects(): Promise<ProjectWithAuthor[]> {
  const rows = await query<{
    id: string;
    title: string;
    category: string | null;
    description: string | null;
    status: ProjectStatus;
    created_at: Date;
    completed_at: Date | null;
    paid_at: Date | null;
    url: string | null;
    owner_id: string;
    full_name: string;
    role: Role;
    company: string | null;
    avatar_key: string | null;
    avatar_updated_at: Date | null;
  }>(
    `SELECT p.id, p.title, p.category, p.description, p.status, p.created_at, p.completed_at, p.paid_at, p.url,
            u.id AS owner_id, u.full_name, u.role, u.company, u.avatar_key, u.avatar_updated_at
       FROM projects p JOIN users u ON u.id = p.owner_id
      ORDER BY p.created_at DESC`,
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    description: r.description,
    status: r.status,
    createdAt: r.created_at.toISOString(),
    completedAt: r.completed_at?.toISOString() ?? null,
    paidAt: r.paid_at?.toISOString() ?? null,
    url: r.url,
    owner: {
      id: r.owner_id,
      name: r.full_name,
      role: r.role,
      company: r.company,
      avatarUrl: avatarUrl(r.owner_id, r.avatar_key, r.avatar_updated_at),
    },
  }));
}

/** Chiffres clés d'une liste de projets. */
export function projectStats(projects: { status: ProjectStatus; paidAt: string | null; createdAt: string }[]) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  return {
    total: projects.length,
    propose: projects.filter((p) => p.status === "propose").length,
    en_cours: projects.filter((p) => p.status === "en_cours").length,
    termine: projects.filter((p) => p.status === "termine").length,
    paye: projects.filter((p) => p.paidAt).length,
    thisMonth: projects.filter((p) => new Date(p.createdAt) >= monthStart).length,
  };
}

/** Membres d'une discussion, hors admin (sans la liste des autres inscrits). */
export async function getConversationMembers(conversationId: string): Promise<Participant[]> {
  const rows = await query<{ id: string; full_name: string; role: Role; company: string | null; status: Status }>(
    `SELECT u.id, u.full_name, u.role, u.company, u.status
       FROM conversation_members cm JOIN users u ON u.id = cm.user_id
      WHERE cm.conversation_id = $1 AND u.role <> 'admin'
      ORDER BY cm.joined_at, u.full_name`,
    [conversationId],
  );
  return rows.map((r) => ({ id: r.id, name: r.full_name, role: r.role, company: r.company, status: r.status }));
}

/**
 * Participants de la discussion d'un projet (hors admin) et personnes pouvant être ajoutées.
 */
export async function getProjectParticipants(conversationId: string, adminId: string) {
  const rows = await query<{
    id: string;
    full_name: string;
    role: Role;
    company: string | null;
    status: Status;
    is_member: boolean;
  }>(
    `SELECT u.id, u.full_name, u.role, u.company, u.status,
            EXISTS (SELECT 1 FROM conversation_members cm
                     WHERE cm.conversation_id = $1 AND cm.user_id = u.id) AS is_member
       FROM users u
      WHERE u.id <> $2 AND u.role <> 'admin'
      ORDER BY u.full_name`,
    [conversationId, adminId],
  );
  const toParticipant = (r: (typeof rows)[number]): Participant => ({
    id: r.id,
    name: r.full_name,
    role: r.role,
    company: r.company,
    status: r.status,
  });
  return {
    members: rows.filter((r) => r.is_member).map(toParticipant),
    candidates: rows.filter((r) => !r.is_member).map(toParticipant),
  };
}
