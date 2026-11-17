"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cookie } from "lucide-react";

const STORAGE_KEY = "twinschat:cookies-ok";

/**
 * Bandeau d'information sur les cookies. TwinsChat n'utilise que des cookies strictement nécessaires
 * (session, connexion Google) : pas de mesure d'audience ni de publicité, donc rien à accepter ou refuser.
 * Le bandeau informe une fois, puis se fait oublier (choix gardé sur l'appareil).
 */
export function CookieNotice() {
  const [visible, setVisible] = useState(false);
  // Espaces connectés : la barre de navigation du bas (mobile) reste visible sous le bandeau
  const pathname = usePathname();
  const aboveBottomNav = pathname.startsWith("/admin") || pathname.startsWith("/user");

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* stockage indisponible : le bandeau reviendra à la prochaine visite */
    }
  }

  return (
    <div
      role="region"
      aria-label="Information sur les cookies"
      className={`fixed inset-x-3 z-[60] mx-auto max-w-xl ${aboveBottomNav ? "bottom-[84px]" : "bottom-3"} rounded-2xl border border-white/10 bg-[#0d1518]/95 p-4 shadow-2xl shadow-black/60 backdrop-blur-xl motion-safe:animate-auth-in sm:p-5 md:bottom-6`}
    >
      <div className="flex items-start gap-3.5">
        <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-strong sm:inline-flex">
          <Cookie className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Des cookies uniquement nécessaires</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Seulement ceux indispensables à la connexion et à la sécurité de votre compte : aucun cookie publicitaire ni de
            mesure d&apos;audience.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-[#03140a] transition hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
            >
              J&apos;ai compris
            </button>
            <Link
              href="/cookies"
              className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-medium text-foreground/85 hover:bg-white/5 hover:text-foreground"
            >
              En savoir plus
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
