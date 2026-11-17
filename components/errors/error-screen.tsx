import type { ReactNode } from "react";
import Link from "next/link";
import { StarfieldBackground } from "@/components/auth/starfield-background";
import { StackedLogo } from "@/components/brand/logo";

/*
 * Illustrations des pages d'erreur : robots du jeu « HTTP Status Code Images » de Dr. Link Check,
 * licence CC BY 4.0, recolorés aux couleurs de TwinsChat (public/illustrations).
 */
export const ILLUSTRATIONS = {
  notFound: {
    src: "/illustrations/robot-404.svg",
    width: 240,
    height: 276,
    alt: "Un petit robot vert flotte, les bras ouverts : il a cherché partout sans trouver la page.",
  },
  error: {
    src: "/illustrations/robot-debranche.svg",
    width: 320,
    height: 229,
    alt: "Un petit robot vert dont la prise est débranchée du mur, avec des étincelles.",
  },
} as const;

/**
 * Écran commun des pages d'erreur (404, erreur inattendue) : fond étoilé de l'accueil,
 * logo, illustration, texte, actions et crédit de l'illustration.
 */
export function ErrorScreen({
  illustration,
  code,
  title,
  children,
  actions,
}: {
  illustration: (typeof ILLUSTRATIONS)[keyof typeof ILLUSTRATIONS];
  /** Petit libellé au-dessus du titre (ex. « Erreur 404 »). */
  code: string;
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10 short:py-5">
      <StarfieldBackground />
      <div className="relative flex w-full max-w-lg flex-col items-center text-center motion-safe:animate-auth-in">
        <Link href="/" aria-label="TwinsChat, accueil" className="transition-transform hover:scale-105">
          <StackedLogo className="w-28 drop-shadow-[0_0_24px_rgba(34,197,94,0.22)] short:w-24" gradientId="tc-bubble-error" />
        </Link>

        {/* Halo clair derrière le robot : ses contours sombres restent lisibles sur le fond nuit */}
        <div className="relative mt-6 flex w-full justify-center short:mt-3">
          <span
            aria-hidden
            className="absolute top-1/2 left-1/2 size-[min(78vw,20rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(148,163,184,0.22),rgba(34,197,94,0.10)_55%,transparent)] short:size-56"
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG statique : pas d'optimisation d'image utile */}
          <img
            src={illustration.src}
            width={illustration.width}
            height={illustration.height}
            alt={illustration.alt}
            fetchPriority="high"
            decoding="async"
            className="relative h-auto w-[min(62vw,var(--w))] drop-shadow-[0_18px_30px_rgba(0,0,0,0.55)] motion-safe:animate-err-float short:w-[min(50vw,calc(var(--w)*0.7))]"
            style={{ ["--w" as string]: `${illustration.width}px` }}
          />
        </div>

        <p className="mt-6 text-xs font-semibold tracking-[0.2em] text-accent-strong uppercase short:mt-4">{code}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <div className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">{children}</div>
        <div className="mt-8 flex w-full flex-col-reverse items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center short:mt-6">
          {actions}
        </div>
      </div>

      {/* Crédit exigé par la licence CC BY 4.0 de l'illustration */}
      <p className="relative mt-10 text-center text-[11px] text-muted/70 short:mt-6">
        Illustration :{" "}
        <a
          href="https://www.drlinkcheck.com/blog/free-http-error-images"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Dr. Link Check
        </a>{" "}
        (
        <a
          href="https://creativecommons.org/licenses/by/4.0/deed.fr"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          CC BY 4.0
        </a>
        ), couleurs adaptées
      </p>
    </main>
  );
}

/** Bouton principal des pages d'erreur (lien ou bouton). */
export const primaryAction =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#34d36f] to-[#16a34a] px-6 text-[15px] font-semibold text-[#03140a] shadow-[0_12px_30px_-12px_rgba(34,197,94,0.85),inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong active:scale-[0.985]";

/** Bouton secondaire des pages d'erreur. */
export const secondaryAction =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] px-5 text-sm font-medium text-foreground/90 transition hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong";
