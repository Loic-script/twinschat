import "server-only";
import { sendNotification, setVapidDetails } from "web-push";
import { query } from "@/lib/db";
import { DEFAULT_PREFS } from "@/lib/notifications";
import type { NotificationPrefs } from "@/lib/types";

/*
 * Notifications push (Web Push) : envoyées aux appareils abonnés (téléphone, ordinateur), même application fermée.
 * Clés VAPID dans .env.local (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT). Le contenu est chiffré
 * de bout en bout jusqu'à l'appareil ; le service worker (public/sw.js) l'affiche et ouvre `url` au clic.
 */

export type PushPayload = {
  title: string;
  body: string;
  /** Page ouverte au clic. */
  url: string;
  /** Regroupe les notifications d'une même discussion (la plus récente remplace l'ancienne, avec son et vibration). */
  tag?: string;
};

type Category = Exclude<keyof NotificationPrefs, "navigateur">;

/** Clé publique transmise au navigateur pour l'abonnement ("" si les notifications push ne sont pas configurées). */
export const pushPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? "";

export const pushConfigured = () => !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;

let vapidReady: boolean | null = null;
function ensureVapid() {
  if (vapidReady !== null) return vapidReady;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return (vapidReady = false);
  // Contact du responsable du site, exigé par les services de notification (Google, Apple, Mozilla)
  const site = process.env.SITE_URL ?? "";
  const subject = process.env.VAPID_SUBJECT || (site.startsWith("https://") ? site : "mailto:notifications@example.com");
  try {
    setVapidDetails(subject, publicKey, privateKey);
    return (vapidReady = true);
  } catch (err) {
    console.error("[push] clés VAPID invalides :", err instanceof Error ? err.message : err);
    return (vapidReady = false);
  }
}

/**
 * Services de notification des navigateurs (Chrome/Edge/Android, Firefox, Safari/iPhone, Windows) :
 * seules ces adresses d'abonnement sont acceptées, pour que le serveur n'envoie jamais de requête ailleurs.
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /(^|\.)push\.apple\.com$/,
  /(^|\.)notify\.windows\.com$/,
];

export function isPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && PUSH_HOSTS.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}

const clip = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Envoie une notification à chaque appareil abonné des comptes visés, si la catégorie est activée
 * dans leurs préférences. Ne lève jamais d'erreur (les échecs sont journalisés ; abonnements expirés supprimés).
 */
export async function pushToUsers(targets: { userId: string; payload: PushPayload }[], category: Category | null) {
  if (targets.length === 0 || !ensureVapid()) return;
  const payloadOf = new Map(targets.map((t) => [t.userId, t.payload]));
  try {
    const subs = await query<{
      id: string;
      user_id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
      prefs: Partial<NotificationPrefs> | null;
    }>(
      `SELECT s.id, s.user_id, s.endpoint, s.p256dh, s.auth, u.notification_prefs AS prefs
         FROM push_subscriptions s JOIN users u ON u.id = s.user_id
        WHERE s.user_id = ANY($1::uuid[])`,
      [[...payloadOf.keys()]],
    );
    await Promise.all(
      subs.map(async (s) => {
        // `null` : notification de service (ex. test d'activation), envoyée quelles que soient les préférences
        if (category && !{ ...DEFAULT_PREFS, ...(s.prefs ?? {}) }[category]) return;
        const payload = payloadOf.get(s.user_id)!;
        try {
          await sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ ...payload, body: clip(payload.body) }),
            // Gardée 24 h si l'appareil est éteint ; « high » : remise immédiate (téléphone en veille compris)
            { TTL: 24 * 60 * 60, urgency: "high", timeout: 10_000 },
          );
          await query("UPDATE push_subscriptions SET last_push_at = now() WHERE id = $1", [s.id]);
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          // Abonnement expiré ou révoqué (application désinstallée, autorisation retirée) : on l'oublie
          if (status === 404 || status === 410) await query("DELETE FROM push_subscriptions WHERE id = $1", [s.id]);
          else console.error(`[push] envoi impossible (${status ?? "réseau"})`);
        }
      }),
    );
  } catch (err) {
    console.error("[push]", err);
  }
}

/** Nom affiché d'un compte (société pour une entreprise). */
const nameOf = (u: { full_name: string; role: string; company: string | null }) =>
  u.role === "entreprise" && u.company ? u.company : u.full_name;

/** Nouveau message : prévient les autres membres de la discussion. */
export async function pushNewMessage(conversationId: string, senderId: string, body: string, hasFiles: boolean) {
  const [conv] = await query<{ project_id: string | null; project_title: string | null }>(
    `SELECT c.project_id, p.title AS project_title FROM conversations c LEFT JOIN projects p ON p.id = c.project_id WHERE c.id = $1`,
    [conversationId],
  );
  const people = await query<{ id: string; full_name: string; role: string; company: string | null }>(
    `SELECT u.id, u.full_name, u.role, u.company FROM conversation_members m JOIN users u ON u.id = m.user_id
      WHERE m.conversation_id = $1`,
    [conversationId],
  );
  const sender = people.find((p) => p.id === senderId);
  if (!conv || !sender) return;
  const text = body.trim() || (hasFiles ? "📎 Pièce jointe" : "");
  const from = nameOf(sender);

  await pushToUsers(
    people
      .filter((p) => p.id !== senderId)
      .map((p) => {
        const admin = p.role === "admin";
        const url = conv.project_id
          ? admin
            ? `/admin/projets?p=${conv.project_id}`
            : `/user/messages?p=${conv.project_id}`
          : admin
            ? `/admin/messages?c=${conversationId}`
            : `/user/messages?c=${conversationId}`;
        return {
          userId: p.id,
          payload: {
            title: conv.project_title ? `${conv.project_title}` : from,
            body: conv.project_title ? `${from.split(" ")[0]} : ${text}` : text,
            url,
            tag: `discussion-${conversationId}`,
          },
        };
      }),
    "messages",
  );
}

/** Comptes admin (destinataires des inscriptions et propositions de projet). */
const adminIds = async () => (await query<{ id: string }>("SELECT id FROM users WHERE role = 'admin'")).map((r) => r.id);

/** Nouvelle inscription : prévient l'administration. */
export async function pushNewUser(userId: string) {
  const [u] = await query<{ full_name: string; email: string }>("SELECT full_name, email FROM users WHERE id = $1", [userId]);
  if (!u) return;
  await pushToUsers(
    (await adminIds()).map((id) => ({
      userId: id,
      payload: {
        title: "Nouvelle inscription",
        body: `${u.full_name} (${u.email}) vient de créer un compte.`,
        url: `/admin/utilisateurs/${userId}`,
        tag: `inscription-${userId}`,
      },
    })),
    "inscriptions",
  );
}

/** Nouveau projet proposé : prévient l'administration. */
export async function pushNewProject(projectId: string) {
  const [p] = await query<{ title: string; full_name: string; role: string; company: string | null }>(
    `SELECT p.title, u.full_name, u.role, u.company FROM projects p JOIN users u ON u.id = p.owner_id WHERE p.id = $1`,
    [projectId],
  );
  if (!p) return;
  await pushToUsers(
    (await adminIds()).map((id) => ({
      userId: id,
      payload: {
        title: "Nouveau projet proposé",
        body: `« ${p.title} » par ${nameOf(p)}`,
        url: `/admin/projets?p=${projectId}`,
        tag: `projet-${projectId}`,
      },
    })),
    "projets",
  );
}

/** Avancement d'un projet (validé, terminé, payé) : prévient son auteur. */
export async function pushProjectUpdate(projectId: string, event: "valide" | "termine" | "paye") {
  const [p] = await query<{ title: string; owner_id: string }>("SELECT title, owner_id FROM projects WHERE id = $1", [
    projectId,
  ]);
  if (!p) return;
  const copy = {
    valide: { title: "Projet validé", body: `« ${p.title} » est validé : la discussion avec l'équipe est ouverte.` },
    termine: { title: "Projet terminé", body: `« ${p.title} » est terminé.` },
    paye: { title: "Paiement enregistré", body: `Le paiement de « ${p.title} » a bien été enregistré.` },
  }[event];
  await pushToUsers(
    [
      {
        userId: p.owner_id,
        payload: {
          ...copy,
          url: event === "valide" ? `/user/messages?p=${projectId}` : `/user/projets#projet-${projectId}`,
          tag: `projet-${projectId}`,
        },
      },
    ],
    "projets",
  );
}

/** Ajout à la discussion d'un projet : prévient les personnes ajoutées. */
export async function pushAddedToProject(conversationId: string, userIds: string[]) {
  const [c] = await query<{ project_id: string; title: string }>(
    `SELECT c.project_id, p.title FROM conversations c JOIN projects p ON p.id = c.project_id WHERE c.id = $1`,
    [conversationId],
  );
  if (!c) return;
  await pushToUsers(
    userIds.map((id) => ({
      userId: id,
      payload: {
        title: "Nouvelle discussion",
        body: `Vous avez été ajouté à la discussion du projet « ${c.title} ».`,
        url: `/user/messages?p=${c.project_id}`,
        tag: `discussion-projet-${c.project_id}`,
      },
    })),
    "messages",
  );
}

/** Ressource partagée par l'administration : prévient les personnes concernées. */
export async function pushSharedItem(itemId: string, userIds: string[]) {
  // Titre : celui du lien, ou le nom du fichier
  const [item] = await query<{ title: string | null }>(
    `SELECT COALESCE(i.link_title, a.file_name, i.link_url) AS title
       FROM resource_folder_items i LEFT JOIN attachments a ON a.id = i.attachment_id
      WHERE i.id = $1`,
    [itemId],
  );
  await pushToUsers(
    userIds.map((id) => ({
      userId: id,
      payload: {
        title: "Nouveau partage",
        body: item?.title ? `« ${item.title} » a été partagé avec vous.` : "Un élément a été partagé avec vous.",
        url: "/user/ressources?type=partages",
        tag: `partage-${itemId}`,
      },
    })),
    "ressources",
  );
}
