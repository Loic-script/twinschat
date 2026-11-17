"use server";

import { getActor } from "@/lib/auth";
import { query } from "@/lib/db";
import { isPushEndpoint, pushConfigured, pushPublicKey, pushToUsers } from "@/lib/push";
import type { Space } from "@/lib/types";

export type PushSubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };

const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;

/** Clé publique VAPID, nécessaire au navigateur pour s'abonner ("" si non configuré). */
export async function getPushPublicKey(): Promise<string> {
  return pushConfigured() ? pushPublicKey() : "";
}

/** Enregistre l'abonnement push de cet appareil pour le compte de l'espace (remplace l'ancien s'il existe). */
export async function savePushSubscription(
  space: Space,
  sub: PushSubscriptionInput,
  userAgent: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!pushConfigured()) return { ok: false, error: "Les notifications push ne sont pas configurées sur ce site." };
  const endpoint = typeof sub?.endpoint === "string" ? sub.endpoint : "";
  const { p256dh, auth } = sub?.keys ?? { p256dh: "", auth: "" };
  if (
    endpoint.length > 1000 ||
    !isPushEndpoint(endpoint) ||
    typeof p256dh !== "string" ||
    typeof auth !== "string" ||
    p256dh.length > 200 ||
    auth.length > 100 ||
    !B64URL.test(p256dh) ||
    !B64URL.test(auth)
  ) {
    return { ok: false, error: "Abonnement aux notifications invalide." };
  }
  const me = await getActor(space);
  // Un même navigateur peut changer de compte : l'abonnement suit le compte connecté
  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE
       SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent`,
    [me.id, endpoint, p256dh, auth, String(userAgent ?? "").slice(0, 300)],
  );
  // Au plus 10 appareils par compte : les plus anciens abonnements sont oubliés
  await query(
    `DELETE FROM push_subscriptions WHERE user_id = $1 AND id NOT IN
       (SELECT id FROM push_subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10)`,
    [me.id],
  );
  return { ok: true };
}

/** Désabonne cet appareil (le compte ne reçoit plus de notifications push ici). */
export async function removePushSubscription(space: Space, endpoint: string): Promise<{ ok: true }> {
  const me = await getActor(space);
  if (typeof endpoint === "string" && endpoint) {
    await query("DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2", [endpoint, me.id]);
  }
  return { ok: true };
}

/** Notification de test, envoyée à tous les appareils abonnés du compte. */
export async function sendTestPush(space: Space): Promise<{ ok: true }> {
  const me = await getActor(space);
  await pushToUsers(
    [
      {
        userId: me.id,
        payload: {
          title: "Notifications activées ✅",
          body: "Vous recevrez ici vos nouveaux messages, même quand TwinsChat est fermé.",
          url: space === "admin" ? "/admin/messages" : "/user/messages",
          tag: "test",
        },
      },
    ],
    null,
  );
  return { ok: true };
}
