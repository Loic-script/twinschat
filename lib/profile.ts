import "server-only";
import { query } from "./db";
import { avatarUrl } from "./messages";
import type { Role } from "./types";

const coverUrl = (id: string, key: string | null, updatedAt: Date | null) =>
  key ? `/api/avatars/${id}?kind=cover&v=${updatedAt?.getTime() ?? 0}` : null;

export type AdminProfile = {
  id: string;
  /** Pseudo : le nom affiché dans toute l'application. */
  name: string;
  email: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  hasPassword: boolean;
};

export async function getAdminProfile(adminId: string): Promise<AdminProfile> {
  const [r] = await query<{
    id: string;
    full_name: string;
    email: string;
    avatar_key: string | null;
    avatar_updated_at: Date | null;
    cover_key: string | null;
    cover_updated_at: Date | null;
    has_password: boolean;
  }>(
    `SELECT id, full_name, email, avatar_key, avatar_updated_at, cover_key, cover_updated_at,
            password_hash IS NOT NULL AS has_password
       FROM users WHERE id = $1`,
    [adminId],
  );
  return {
    id: r.id,
    name: r.full_name,
    email: r.email,
    avatarUrl: avatarUrl(r.id, r.avatar_key, r.avatar_updated_at),
    coverUrl: coverUrl(r.id, r.cover_key, r.cover_updated_at),
    hasPassword: r.has_password,
  };
}

/** Profil d'un utilisateur, client ou entreprise, tel qu'il le modifie dans son espace. */
export type MemberProfile = {
  id: string;
  name: string;
  email: string;
  role: Exclude<Role, "admin">;
  company: string | null;
  phone: string | null;
  jobTitle: string | null;
  workplace: string | null;
  city: string | null;
  address: string | null;
  description: string | null;
  country: string | null;
  /** Langues parlées (codes ISO 639-1). */
  languages: string[];
  avatarUrl: string | null;
  coverUrl: string | null;
  hasPassword: boolean;
  createdAt: string;
  projectsCount: number;
};

export async function getMemberProfile(userId: string): Promise<MemberProfile> {
  const [r] = await query<{
    id: string;
    full_name: string;
    email: string;
    role: Exclude<Role, "admin">;
    company: string | null;
    phone: string | null;
    job_title: string | null;
    workplace: string | null;
    city: string | null;
    address: string | null;
    description: string | null;
    country: string | null;
    languages: string[];
    avatar_key: string | null;
    avatar_updated_at: Date | null;
    cover_key: string | null;
    cover_updated_at: Date | null;
    has_password: boolean;
    created_at: Date;
    projects_count: number;
  }>(
    `SELECT id, full_name, email, role, company, phone, job_title, workplace, city, address, description, country, languages,
            avatar_key, avatar_updated_at, cover_key, cover_updated_at,
            password_hash IS NOT NULL AS has_password, created_at,
            (SELECT count(*)::int FROM projects p WHERE p.owner_id = users.id) AS projects_count
       FROM users WHERE id = $1 AND role <> 'admin'`,
    [userId],
  );
  return {
    id: r.id,
    name: r.full_name,
    email: r.email,
    role: r.role,
    company: r.company,
    phone: r.phone,
    jobTitle: r.job_title,
    workplace: r.workplace,
    city: r.city,
    address: r.address,
    description: r.description,
    country: r.country,
    languages: r.languages ?? [],
    avatarUrl: avatarUrl(r.id, r.avatar_key, r.avatar_updated_at),
    coverUrl: coverUrl(r.id, r.cover_key, r.cover_updated_at),
    hasPassword: r.has_password,
    createdAt: r.created_at.toISOString(),
    projectsCount: r.projects_count,
  };
}
