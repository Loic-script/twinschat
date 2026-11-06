"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Rafraîchit les données serveur à intervalle régulier tant que l'onglet est visible.
 * Solution simple en attendant le temps réel (WebSocket / LISTEN-NOTIFY).
 */
export function AutoRefresh({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
