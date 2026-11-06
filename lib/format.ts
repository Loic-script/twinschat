import type { ProjectStatus, Role, Status } from "./types";

const LOCALE = "fr-FR";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function daysAgo(iso: string, now = new Date()) {
  return Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000);
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
}

/** Horodatage court pour la liste des conversations. */
export function formatListDate(iso: string) {
  const diff = daysAgo(iso);
  if (diff === 0) return formatTime(iso);
  if (diff === 1) return "Hier";
  if (diff < 7) return new Date(iso).toLocaleDateString(LOCALE, { weekday: "short" });
  return new Date(iso).toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit" });
}

/** Libellé des séparateurs de jour dans le fil. */
export function formatDayLabel(iso: string) {
  const diff = daysAgo(iso);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  const label = new Date(iso).toLocaleDateString(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Pastille de jour façon « Aujourd'hui, 5 nov. ». */
export function formatDayChip(iso: string) {
  const diff = daysAgo(iso);
  const short = new Date(iso).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
  if (diff === 0) return `Aujourd'hui, ${short}`;
  if (diff === 1) return `Hier, ${short}`;
  return formatDayLabel(iso);
}

export function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function formatPresence(status: Status, lastSeenAt: string | null) {
  if (status === "en_ligne") return "En ligne";
  if (status === "absent") return "Absent";
  if (!lastSeenAt) return "Hors ligne";
  const minutes = Math.round((Date.now() - new Date(lastSeenAt).getTime()) / 60_000);
  if (minutes < 60) return `Vu il y a ${Math.max(minutes, 1)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Vu il y a ${hours} h`;
  return `Vu ${formatDayLabel(lastSeenAt).toLowerCase()}`;
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  utilisateur: "Utilisateur",
  client: "Client",
  entreprise: "Entreprise",
};

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric" });
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  propose: "Proposé",
  en_cours: "En cours",
  termine: "Terminé",
};

/** Nom affiché : la société pour une entreprise, sinon le nom et prénom. */
export function displayName(u: { name: string; role: Role; company: string | null }) {
  return u.role === "entreprise" && u.company ? u.company : u.name;
}

/** Ligne secondaire : la personne de contact pour une entreprise, sinon le poste. */
export function displaySubtitle(u: {
  name: string;
  role: Role;
  company: string | null;
  jobTitle: string | null;
  workplace: string | null;
}) {
  if (u.role === "entreprise" && u.company) {
    return u.jobTitle ? `${u.name} · ${u.jobTitle}` : u.name;
  }
  return [u.jobTitle, u.workplace].filter(Boolean).join(" · ");
}

/** « à l'instant », « il y a 5 min », « il y a 3 h », « hier », puis la date. */
export function formatRelative(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const diff = daysAgo(iso);
  if (diff === 0) return `il y a ${Math.round(minutes / 60)} h`;
  if (diff === 1) return "hier";
  if (diff < 7) return `il y a ${diff} jours`;
  return formatDate(iso);
}
