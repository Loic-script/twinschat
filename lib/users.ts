import "server-only";
import { query } from "./db";
import { isUuid } from "./messages";
import type { Project, ProjectStatus, Role, Status, UserCard, UserProfile } from "./types";

export const USERS_PAGE_SIZE = 12;

export type UserRoleFilter = Exclude<Role, "admin">;
const ROLE_FILTERS: UserRoleFilter[] = ["client", "entreprise", "utilisateur"];
export const isRoleFilter = (v: unknown): v is UserRoleFilter =>
  ROLE_FILTERS.includes(v as UserRoleFilter);

type CardRow = {
  id: string;
  full_name: string;
  email: string;
  role: UserRoleFilter;
  company: string | null;
  status: Status;
  last_seen_at: Date | null;
  job_title: string | null;
  workplace: string | null;
  city: string | null;
  projects_total: number;
  projects_active: number;
  projects_done: number;
  latest_title: string | null;
  latest_status: ProjectStatus | null;
};

const CARD_SELECT = `
  SELECT u.id, u.full_name, u.email, u.role, u.company, u.status, u.last_seen_at,
         u.job_title, u.workplace, u.city,
         (SELECT count(*)::int FROM projects p WHERE p.owner_id = u.id) AS projects_total,
         (SELECT count(*)::int FROM projects p WHERE p.owner_id = u.id AND p.status = 'en_cours') AS projects_active,
         (SELECT count(*)::int FROM projects p WHERE p.owner_id = u.id AND p.status = 'termine') AS projects_done,
         lp.title AS latest_title, lp.status AS latest_status
    FROM users u
    LEFT JOIN LATERAL (
      SELECT title, status FROM projects p WHERE p.owner_id = u.id
       ORDER BY p.created_at DESC LIMIT 1
    ) lp ON true
`;

function toCard(r: CardRow): UserCard {
  return {
    id: r.id,
    name: r.full_name,
    email: r.email,
    role: r.role,
    company: r.company,
    status: r.status,
    lastSeenAt: r.last_seen_at?.toISOString() ?? null,
    jobTitle: r.job_title,
    workplace: r.workplace,
    city: r.city,
    projectsTotal: r.projects_total,
    projectsActive: r.projects_active,
    projectsDone: r.projects_done,
    latestProject: r.latest_title ? { title: r.latest_title, status: r.latest_status! } : null,
  };
}

/** Échappe % et _ pour une recherche ILIKE littérale. */
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function listUsers(opts: { q?: string; role?: UserRoleFilter; page?: number }) {
  const q = opts.q?.trim() || null;
  const role = opts.role ?? null;
  const where = `
    WHERE u.role <> 'admin'
      AND ($1::user_role IS NULL OR u.role = $1::user_role)
      AND ($2::text IS NULL
           OR u.full_name ILIKE $2 OR u.email ILIKE $2 OR u.company ILIKE $2
           OR u.workplace ILIKE $2 OR u.city ILIKE $2
           OR EXISTS (SELECT 1 FROM projects p WHERE p.owner_id = u.id AND p.title ILIKE $2))`;
  const params = [role, q ? likePattern(q) : null];

  const [{ total }] = await query<{ total: number }>(
    `SELECT count(*)::int AS total FROM users u ${where}`,
    params,
  );
  const pageCount = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));
  const page = Math.min(Math.max(1, opts.page ?? 1), pageCount);

  const rows = await query<CardRow>(
    `${CARD_SELECT} ${where}
     ORDER BY (u.status = 'en_ligne') DESC, u.last_seen_at DESC NULLS LAST, u.full_name
     LIMIT ${USERS_PAGE_SIZE} OFFSET $3`,
    [...params, (page - 1) * USERS_PAGE_SIZE],
  );
  return { users: rows.map(toCard), total, page, pageCount };
}

export async function getUserProfile(userId: string, adminId: string): Promise<UserProfile | null> {
  if (!isUuid(userId)) return null;
  const [row] = await query<
    CardRow & {
      address: string | null;
      description: string | null;
      created_at: Date;
      country: string | null;
      languages: string[];
    }
  >(
    `${CARD_SELECT.replace("u.job_title,", "u.job_title, u.address, u.description, u.created_at, u.country, u.languages,")}
     WHERE u.id = $1 AND u.role <> 'admin'`,
    [userId],
  );
  if (!row) return null;

  const [projects, [conv]] = await Promise.all([
    query<{
      id: string;
      title: string;
      category: string | null;
      description: string | null;
      status: ProjectStatus;
      created_at: Date;
      completed_at: Date | null;
      paid_at: Date | null;
      url: string | null;
    }>(
      `SELECT id, title, category, description, status, created_at, completed_at, paid_at, url
         FROM projects WHERE owner_id = $1
        ORDER BY (status = 'termine'), created_at DESC`,
      [userId],
    ),
    query<{ id: string }>(
      `SELECT c.id FROM conversations c
         JOIN conversation_members a ON a.conversation_id = c.id AND a.user_id = $1
         JOIN conversation_members b ON b.conversation_id = c.id AND b.user_id = $2
        WHERE c.kind = 'direct' LIMIT 1`,
      [adminId, userId],
    ),
  ]);

  return {
    ...toCard(row),
    address: row.address,
    country: row.country,
    languages: row.languages ?? [],
    description: row.description,
    createdAt: row.created_at.toISOString(),
    conversationId: conv?.id ?? null,
    projects: projects.map(
      (p): Project => ({
        id: p.id,
        title: p.title,
        category: p.category,
        description: p.description,
        status: p.status,
        createdAt: p.created_at.toISOString(),
        completedAt: p.completed_at?.toISOString() ?? null,
        paidAt: p.paid_at?.toISOString() ?? null,
        url: p.url,
      }),
    ),
  };
}

/** Inscrits (hors admin), quels que soient les filtres : total, en ligne et répartition par type. */
export async function getRegisteredStats() {
  const [row] = await query<{ total: number; online: number; client: number; entreprise: number; utilisateur: number }>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE status = 'en_ligne')::int AS online,
            count(*) FILTER (WHERE role = 'client')::int AS client,
            count(*) FILTER (WHERE role = 'entreprise')::int AS entreprise,
            count(*) FILTER (WHERE role = 'utilisateur')::int AS utilisateur
       FROM users WHERE role <> 'admin'`,
  );
  return row;
}
