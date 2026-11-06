"use client";

import { useEffect, useRef, useState } from "react";

/** Écran en hauteur (téléphone) : vidéo verticale ; écran en largeur (ordinateur) : vidéo horizontale. */
const PORTRAIT_QUERY = "(orientation: portrait)";

/**
 * La vidéo occupe toute la largeur de l'écran (jamais rognée sur les côtés : le texte reste entier).
 * Ses bords haut et bas se fondent dans le fond, ce qui masque les bandes sur les écrans plus étroits.
 */
const EDGE_FADE = "linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)";

/**
 * Animation d'ouverture de la page d'accueil (à chaque chargement) : vidéo plein écran
 * (format téléphone ou ordinateur), puis la page apparaît en fondu. Bouton « Passer ».
 * Ignorée si la vidéo ne peut pas être lue.
 */
export function IntroSplash() {
  const [phase, setPhase] = useState<"playing" | "leaving" | "done">("playing");
  const [src, setSrc] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const finished = useRef(false);

  /** `reason` : pourquoi l'animation a été écourtée (affiché dans la console, pour le diagnostic). */
  function finish(immediate = false, reason?: string) {
    if (finished.current) return;
    finished.current = true;
    if (reason) {
      const v = videoRef.current;
      console.warn(`[intro] animation ignorée : ${reason} (readyState=${v?.readyState}, networkState=${v?.networkState})`);
    }
    if (immediate) return setPhase("done");
    setPhase("leaving");
    setTimeout(() => setPhase("done"), 600);
  }

  useEffect(() => {
    // Une seule vidéo téléchargée : celle qui correspond à l'écran.
    // Adresse sans « .mp4 » : évite l'interception par les gestionnaires de téléchargement (IDM…).
    // « ?v=2 » : version H.264 (l'ancienne version HEVC a pu rester 24 h dans le cache du navigateur).
    setSrc(`/api/intro/${window.matchMedia(PORTRAIT_QUERY).matches ? "mobile" : "pc"}?v=2`);
    // Filet de sécurité : l'application s'ouvre même si la vidéo ne démarre jamais.
    const guard = setTimeout(() => {
      const v = videoRef.current;
      if (!v || v.paused || v.videoWidth === 0) finish(true, "la vidéo n'a pas démarré en 8 s");
    }, 8000);
    return () => clearTimeout(guard);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uniquement à l'ouverture
  }, []);

  // Pendant l'animation, la page derrière ne défile pas.
  useEffect(() => {
    if (phase === "done") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div
      id="tc-intro"
      role="presentation"
      className={`fixed inset-0 z-[100] overflow-hidden bg-background transition-opacity duration-500 ease-out ${
        phase === "leaving" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {src && (
        <video
          ref={videoRef}
          src={src}
          autoPlay
          muted
          playsInline
          preload="auto"
          aria-hidden
          className="absolute inset-x-0 top-1/2 h-auto w-full -translate-y-1/2"
          style={{ WebkitMaskImage: EDGE_FADE, maskImage: EDGE_FADE }}
          onLoadedMetadata={(e) => {
            // Piste vidéo illisible (codec non pris en charge) : on ouvre directement l'application.
            if (e.currentTarget.videoWidth === 0) finish(true, "image illisible (codec non pris en charge)");
          }}
          onCanPlay={(e) => {
            e.currentTarget.play().catch((err: Error) => finish(true, `lecture refusée (${err.name})`));
          }}
          onEnded={() => finish()}
          onError={(e) => finish(true, `erreur de chargement (code ${e.currentTarget.error?.code ?? "?"})`)}
        />
      )}
      <button
        type="button"
        onClick={() => finish()}
        className="absolute right-5 bottom-5 rounded-full border border-white/20 bg-black/40 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur transition-colors hover:bg-black/60 md:right-8 md:bottom-8"
      >
        Passer
      </button>
    </div>
  );
}
