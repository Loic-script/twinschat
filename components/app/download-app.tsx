"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import {
  APP_BANNER_HIDDEN_KEY,
  APP_FILES,
  APP_INSTALLED_KEY,
  runsAsApp,
  useAppDownloadState,
  useBannerHidden,
  writeFlag,
  type AppPlatform,
} from "@/lib/app-download";

/** Ouvert dans l'appli : on le retient, pour ne plus proposer le téléchargement sur cet appareil. */
function useRememberApp() {
  useEffect(() => {
    if (runsAsApp()) writeFlag(APP_INSTALLED_KEY);
  }, []);
}

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong";

/** Boutons Windows et Android ; celui de l'appareil du visiteur est mis en avant. Sur iPhone : la marche à suivre. */
function Choices({ platform, compact = false }: { platform: AppPlatform; compact?: boolean }) {
  if (platform === "ios") {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted">
        <Share className="size-4 shrink-0 text-accent-strong" aria-hidden />
        <span>
          Touchez <strong className="font-semibold text-foreground">Partager</strong>, puis{" "}
          <strong className="font-semibold text-foreground">Sur l&apos;écran d&apos;accueil</strong>.
        </span>
      </p>
    );
  }

  const order = (platform === "android" ? ["android", "windows"] : ["windows", "android"]) as ("windows" | "android")[];
  const size = compact ? "h-9 px-3.5 text-[13px]" : "h-10 px-4 text-sm";
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {order.map((key) => {
        const featured = key === platform;
        return (
          <a
            key={key}
            href={APP_FILES[key].href}
            download
            className={`items-center gap-1.5 rounded-xl font-semibold transition ${size} ${FOCUS} ${
              // Bandeau sur petit écran : seulement l'appli de l'appareil
              compact && !featured && platform !== "other" ? "hidden sm:inline-flex" : "inline-flex"
            } ${
              featured
                ? "bg-accent text-[#03140a] shadow-[0_6px_20px_-8px_rgba(34,197,94,0.8)] hover:bg-accent-strong"
                : "border border-white/10 bg-white/[0.04] text-foreground hover:border-accent/50 hover:text-accent-strong"
            }`}
          >
            <Download className="size-4" aria-hidden />
            {APP_FILES[key].label}
          </a>
        );
      })}
    </div>
  );
}

/** Page de connexion : sous la carte, pour qui n'a pas encore l'appli. */
export function DownloadAppLinks() {
  useRememberApp();
  const state = useAppDownloadState();
  if (state === null || state === "installed") return null;

  return (
    <section
      aria-label="Télécharger l'application"
      className="mt-5 rounded-2xl border border-white/[0.07] bg-[#091013]/80 px-4 py-3.5 backdrop-blur-xl motion-safe:animate-auth-in motion-safe:[animation-delay:240ms]"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm font-semibold">
          Téléchargez l&apos;appli <span className="text-accent-strong">TwinsChat</span>
        </p>
        <Choices platform={state} />
      </div>
    </section>
  );
}

/** Espaces connectés : bandeau fin en haut du contenu, que l'on peut masquer. */
export function DownloadAppBanner() {
  useRememberApp();
  const state = useAppDownloadState();
  const hiddenBefore = useBannerHidden();
  const [hiddenNow, setHiddenNow] = useState(false);
  if (state === null || state === "installed" || hiddenBefore || hiddenNow) return null;

  function hide() {
    setHiddenNow(true);
    writeFlag(APP_BANNER_HIDDEN_KEY);
  }

  return (
    <div
      role="region"
      aria-label="Télécharger l'application"
      className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60 bg-accent/[0.07] py-2.5 pl-4 pr-2 md:pl-6"
    >
      <p className="min-w-0 flex-1 text-sm font-medium">
        Installez l&apos;appli <span className="text-accent-strong">TwinsChat</span>
        <span className="hidden sm:inline"> sur cet appareil</span>
      </p>
      <div className="flex items-center gap-1">
        <Choices platform={state} compact />
        <button
          type="button"
          onClick={hide}
          aria-label="Masquer"
          title="Masquer"
          className={`ml-1 grid size-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-white/10 hover:text-foreground ${FOCUS}`}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
