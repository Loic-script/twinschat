"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Loader2, Smartphone } from "lucide-react";
import {
  getPushPublicKey,
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
  type PushSubscriptionInput,
} from "@/lib/actions/push";
import type { Space } from "@/lib/types";

/*
 * Notifications push côté navigateur : service worker (public/sw.js), abonnement de l'appareil,
 * mise à jour en temps réel des pages ouvertes quand une notification arrive.
 */

const SW_URL = "/sw.js";

function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof Notification !== "undefined"
  );
}

/** iPhone / iPad : les notifications push n'y marchent que dans l'application installée (écran d'accueil). */
function iosNeedsInstall() {
  if (typeof window === "undefined") return false;
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

/** Clé publique VAPID (base64url) → tableau d'octets attendu par pushManager.subscribe. */
function keyBytes(base64url: string) {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const toInput = (sub: PushSubscription) => sub.toJSON() as PushSubscriptionInput;

function registration() {
  return navigator.serviceWorker.register(SW_URL, { scope: "/" });
}

/**
 * À monter une fois par espace : enregistre le service worker, garde l'abonnement de l'appareil rattaché
 * au compte connecté, et rafraîchit la page quand une notification arrive (nouveaux messages en temps réel).
 */
export function PushBridge({ space }: { space: Space }) {
  const router = useRouter();

  useEffect(() => {
    if (!pushSupported()) return;
    let cancelled = false;

    (async () => {
      try {
        const reg = await registration();
        const sub = await reg.pushManager.getSubscription();
        // Déjà abonné (et autorisé) : on confirme l'abonnement pour le compte connecté
        if (!cancelled && sub && Notification.permission === "granted") {
          await savePushSubscription(space, toInput(sub), navigator.userAgent);
        }
      } catch {
        /* service worker indisponible (navigation privée, réglages) : l'application fonctionne sans */
      }
    })();

    const onMessage = async (event: MessageEvent) => {
      if (event.data?.type === "push") router.refresh();
      if (event.data?.type === "push-resubscribe" && Notification.permission === "granted") {
        try {
          const key = await getPushPublicKey();
          const reg = await registration();
          const sub =
            (await reg.pushManager.getSubscription()) ??
            (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
          await savePushSubscription(space, toInput(sub), navigator.userAgent);
        } catch {
          /* nouvel essai à la prochaine ouverture */
        }
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, [space, router]);

  return null;
}

type Status = "loading" | "unsupported" | "install" | "denied" | "off" | "on";

const HINTS: Record<Status, string> = {
  loading: "Vérification…",
  unsupported: "Non prises en charge par ce navigateur.",
  install: "Sur iPhone : touchez Partager, puis « Sur l'écran d'accueil ». Ouvrez TwinsChat depuis l'icône pour les activer.",
  denied: "Bloquées : autorisez les notifications pour ce site dans les réglages du navigateur.",
  off: "Recevez vos messages sur cet appareil, même quand TwinsChat est fermé (son et vibration).",
  on: "Activées sur cet appareil.",
};

/** Interrupteur « Notifications push sur cet appareil » (panneau de notifications). */
export function PushSwitch({ space }: { space: Space }) {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    if (iosNeedsInstall()) return setStatus("install");
    if (!pushSupported()) return setStatus("unsupported");
    if (Notification.permission === "denied") return setStatus("denied");
    try {
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub && Notification.permission === "granted" ? "on" : "off");
    } catch {
      setStatus("unsupported");
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  async function enable() {
    setError(null);
    setBusy(true);
    try {
      // Demandée juste après le clic (exigé par les navigateurs)
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const key = await getPushPublicKey();
      if (!key) throw new Error("Les notifications push ne sont pas configurées sur ce site.");
      const reg = await registration();
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
      const res = await savePushSubscription(space, toInput(sub), navigator.userAgent);
      if (!res.ok) throw new Error(res.error);
      setStatus("on");
      await sendTestPush(space);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation impossible.");
      await refreshStatus();
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setError(null);
    setBusy(true);
    try {
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(space, sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
    } catch {
      setError("Désactivation impossible.");
    } finally {
      setBusy(false);
    }
  }

  const checked = status === "on";
  const disabled = busy || (status !== "off" && status !== "on");

  return (
    <li className="py-3">
      <div className="flex items-center gap-4">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            {status === "install" ? (
              <Smartphone className="size-4 text-accent-strong" />
            ) : (
              <BellRing className="size-4 text-accent-strong" />
            )}
            Notifications push
          </span>
          <span className="block text-xs text-muted">{HINTS[status]}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label="Notifications push sur cet appareil"
          disabled={disabled}
          onClick={() => void (checked ? disable() : enable())}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            checked ? "bg-accent" : "bg-surface-2"
          }`}
        >
          {busy ? (
            <Loader2 className="mx-auto size-4 animate-spin text-foreground" />
          ) : (
            <span
              className={`inline-block size-5 rounded-full bg-foreground shadow transition-transform ${
                checked ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          )}
        </button>
      </div>
      {checked && !busy && (
        <button
          type="button"
          onClick={() => void sendTestPush(space)}
          className="mt-2 text-xs font-medium text-accent-strong hover:underline"
        >
          Envoyer une notification de test
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-300">
          {error}
        </p>
      )}
    </li>
  );
}
