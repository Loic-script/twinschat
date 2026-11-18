import { useSyncExternalStore } from "react";

/**
 * Téléchargement de l'appli TwinsChat (APK Android, installateur Windows). Les fichiers sont publiés sur le
 * portfolio TwinsDev (une seule copie à tenir à jour) ; on les propose à qui n'a pas encore l'appli.
 */
const DOWNLOADS = "https://twinsdev.ucan-mih.com/telechargements";

export const APP_FILES = {
  windows: { href: `${DOWNLOADS}/TwinsChat-Setup.exe`, label: "Windows" },
  android: { href: `${DOWNLOADS}/TwinsChat.apk`, label: "Android" },
} as const;

/** Appli déjà installée sur cet appareil (posé ici ou par /appli-windows.html, ouvert par l'installateur Windows). */
export const APP_INSTALLED_KEY = "twinschat:appli";
/** Le visiteur a masqué le bandeau « Installez l'appli » dans son espace. */
export const APP_BANNER_HIDDEN_KEY = "twinschat:appli-masquee";

export type AppPlatform = "windows" | "android" | "ios" | "other";
/** « installed » : on tourne dans l'appli (ou elle est installée sur l'appareil) : rien à proposer. */
export type AppDownloadState = AppPlatform | "installed";

function detectPlatform(): AppPlatform {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Windows/i.test(ua)) return "windows";
  return "other";
}

/** Page ouverte dans l'appli : APK (plein écran), appli de l'écran d'accueil, fenêtre d'application. */
export function runsAsApp(): boolean {
  const modes = ["standalone", "fullscreen", "minimal-ui", "window-controls-overlay"];
  if (modes.some((mode) => window.matchMedia(`(display-mode: ${mode})`).matches)) return true;
  if ((navigator as Navigator & { standalone?: boolean }).standalone) return true;
  return document.referrer.startsWith("android-app://");
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

export function writeFlag(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* stockage indisponible : la proposition reviendra à la prochaine visite */
  }
}

const noSubscription = () => () => {};
const readState = (): AppDownloadState => (runsAsApp() || readFlag(APP_INSTALLED_KEY) ? "installed" : detectPlatform());

/** État côté navigateur ; null au rendu serveur (rien n'est affiché avant de connaître l'appareil). */
export function useAppDownloadState(): AppDownloadState | null {
  return useSyncExternalStore(noSubscription, readState, () => null);
}

/** Bandeau masqué par le visiteur (vrai au rendu serveur : pas d'apparition fugace). */
export function useBannerHidden(): boolean {
  return useSyncExternalStore(noSubscription, () => readFlag(APP_BANNER_HIDDEN_KEY), () => true);
}
