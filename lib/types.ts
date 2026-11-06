export type Role = "admin" | "utilisateur" | "client" | "entreprise";
export type Status = "en_ligne" | "absent" | "hors_ligne";

/** Espace de l'application : /admin (administration) ou /user (utilisateurs, clients, entreprises). */
export type Space = "admin" | "user";

export type Contact = {
  id: string;
  name: string;
  email: string;
  role: Role;
  company: string | null;
  status: Status;
  lastSeenAt: string | null;
  /** Photo de profil, ou `null` (initiales affichées à la place). */
  avatarUrl?: string | null;
};

export type ConversationSummary = {
  id: string;
  contact: Contact;
  /** Projet de la discussion (discussions de projet uniquement). */
  project?: { id: string; title: string; status: ProjectStatus; ownerId: string } | null;
  lastMessage: {
    body: string;
    at: string;
    fromMe: boolean;
    deleted: boolean;
  } | null;
  unread: number;
  /** Dernière lecture de la conversation par le contact (accusés de lecture). */
  contactLastReadAt: string | null;
};

export type MessageAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  /** Aperçu local (blob:) pendant l'envoi, avant que le fichier soit servi par le serveur. */
  localUrl?: string;
};

export type Message = {
  id: string;
  body: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  pinned: boolean;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  attachments: MessageAttachment[];
  /** Réactions, regroupées par emoji (qui a réagi). */
  reactions: MessageReaction[];
};

export type MessageReaction = { emoji: string; userIds: string[]; names: string[] };

/** Emojis proposés pour réagir à un message. */
export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  /** Photo de profil, ou `null` (initiales affichées à la place). */
  avatarUrl: string | null;
};

export type ProjectStatus = "propose" | "en_cours" | "termine";

export type Project = {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  status: ProjectStatus;
  createdAt: string;
  completedAt: string | null;
  /** Date du paiement, `null` si le projet n'est pas encore payé. */
  paidAt: string | null;
  url: string | null;
};

export type UserCard = {
  id: string;
  name: string;
  email: string;
  role: Exclude<Role, "admin">;
  company: string | null;
  status: Status;
  lastSeenAt: string | null;
  jobTitle: string | null;
  workplace: string | null;
  city: string | null;
  projectsTotal: number;
  projectsActive: number;
  projectsDone: number;
  latestProject: { title: string; status: ProjectStatus } | null;
};

export type UserProfile = UserCard & {
  address: string | null;
  country: string | null;
  /** Langues parlées (codes ISO 639-1). */
  languages: string[];
  description: string | null;
  createdAt: string;
  projects: Project[];
  /** Conversation existante avec l'admin, s'il y en a une. */
  conversationId: string | null;
};

export type NotificationKind =
  // Espace admin
  | "message"
  | "inscription"
  | "projet"
  | "projet_termine"
  // Espace utilisateur (en plus de « message »)
  | "mon_projet_termine"
  | "mon_projet_paye"
  | "ajout_discussion"
  | "partage";

export type NotificationPrefs = {
  messages: boolean;
  /** Admin : nouvelles inscriptions. */
  inscriptions: boolean;
  projets: boolean;
  /** Utilisateur : ressources partagées avec lui. */
  ressources: boolean;
  /** Notifications système du navigateur quand l'onglet est en arrière-plan. */
  navigateur: boolean;
};

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  at: string;
  unread: boolean;
  actor: { id: string; name: string; role: Role; company: string | null };
  /** Extrait du message ou titre du projet. */
  detail: string | null;
  href: string;
};

export type NotificationFeed = {
  items: NotificationItem[];
  unreadCount: number;
  prefs: NotificationPrefs;
};
