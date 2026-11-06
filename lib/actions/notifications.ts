"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/auth";
import { query } from "@/lib/db";
import type { NotificationPrefs, Space } from "@/lib/types";

/** Remet le compteur de la cloche à zéro (appelé à l'ouverture du panneau). */
export async function markNotificationsSeen(space: Space) {
  const me = await getActor(space);
  await query("UPDATE users SET notifications_seen_at = now() WHERE id = $1", [me.id]);
  revalidatePath(`/${space}`, "layout");
}

const PREF_KEYS: (keyof NotificationPrefs)[] = ["messages", "inscriptions", "projets", "ressources", "navigateur"];

export async function updateNotificationPrefs(space: Space, input: NotificationPrefs) {
  const me = await getActor(space);
  // On ne garde que les clés connues, en booléens stricts.
  const prefs = Object.fromEntries(PREF_KEYS.map((k) => [k, input?.[k] === true]));
  await query("UPDATE users SET notification_prefs = $2::jsonb WHERE id = $1", [me.id, JSON.stringify(prefs)]);
  revalidatePath(`/${space}`, "layout");
}
