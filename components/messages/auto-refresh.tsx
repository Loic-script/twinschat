"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Rafraîchit les données serveur (nouveaux messages, notifications) sans surcharger le serveur :
 * - notifications push actives sur l'appareil : la page est rafraîchie dès qu'une notification arrive
 *   (le service worker la prévient, cf. PushBridge) ; contrôle de secours toutes les `slowMs` ;
 * - sinon : toutes les `intervalMs` tant que l'utilisateur est actif, toutes les `slowMs` après `idleAfterMs` d'inactivité ;
 * - rafraîchissement immédiat au retour sur l'onglet ou quand la connexion revient ; rien hors ligne ou onglet caché.
 */
export function AutoRefresh({
  intervalMs = 5_000,
  slowMs = 30_000,
  idleAfterMs = 120_000,
}: {
  intervalMs?: number;
  slowMs?: number;
  idleAfterMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let pushActive = false;
    let lastRefresh = Date.now();
    let lastActivity = Date.now();

    const idle = () => Date.now() - lastActivity > idleAfterMs;
    const canRefresh = () => document.visibilityState === "visible" && navigator.onLine !== false;
    const refresh = () => {
      lastRefresh = Date.now();
      router.refresh();
    };
    const schedule = () => {
      clearTimeout(timer);
      if (stopped) return;
      timer = setTimeout(tick, pushActive || idle() ? slowMs : intervalMs);
    };
    function tick() {
      if (canRefresh()) refresh();
      schedule();
    }

    // Retour d'inactivité : rattrapage immédiat puis rythme normal
    const onActivity = () => {
      const wasIdle = idle();
      lastActivity = Date.now();
      if (wasIdle && !pushActive) {
        if (canRefresh() && Date.now() - lastRefresh > intervalMs) refresh();
        schedule();
      }
    };
    // Retour sur l'onglet ou connexion retrouvée : données à jour tout de suite
    const onBack = () => {
      if (canRefresh() && Date.now() - lastRefresh > 2_000) {
        refresh();
        schedule();
      }
    };
    // Notification reçue : la page vient d'être rafraîchie par PushBridge, le prochain contrôle est repoussé
    const onWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "push") {
        lastRefresh = Date.now();
        schedule();
      }
    };

    // Notifications push actives sur cet appareil ? (sinon on garde le rythme rapide)
    void (async () => {
      try {
        if (!("serviceWorker" in navigator) || typeof Notification === "undefined") return;
        if (Notification.permission !== "granted") return;
        const reg = await navigator.serviceWorker.getRegistration("/");
        pushActive = Boolean(await reg?.pushManager.getSubscription());
        schedule();
      } catch {
        /* service worker indisponible : rythme rapide */
      }
    })();

    const activityEvents = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
    activityEvents.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener("scroll", onActivity, { passive: true, capture: true });
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("online", onBack);
    navigator.serviceWorker?.addEventListener("message", onWorkerMessage);
    schedule();

    return () => {
      stopped = true;
      clearTimeout(timer);
      activityEvents.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("scroll", onActivity, { capture: true });
      document.removeEventListener("visibilitychange", onBack);
      window.removeEventListener("online", onBack);
      navigator.serviceWorker?.removeEventListener("message", onWorkerMessage);
    };
  }, [router, intervalMs, slowMs, idleAfterMs]);

  return null;
}
