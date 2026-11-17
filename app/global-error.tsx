"use client";

import { Outfit } from "next/font/google";
import { RotateCcw } from "lucide-react";
import { ErrorScreen, ILLUSTRATIONS, primaryAction, secondaryAction } from "@/components/errors/error-screen";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin", "latin-ext"], variable: "--font-outfit", display: "swap" });

/**
 * Erreur grave (dans la mise en page racine) : remplace tout le document, d'où <html> et <body>,
 * avec les styles et la police de l'application.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";
  return (
    <html lang="fr" className={outfit.variable}>
      <body>
        <title>Erreur · TwinsChat</title>
        <ErrorScreen
          illustration={ILLUSTRATIONS.error}
          code="Erreur"
          title="TwinsChat est momentanément indisponible"
          actions={
            <>
              {/* Lien classique (rechargement complet) : l'application elle-même est en erreur */}
              <a href="/" className={secondaryAction}>
                Retour à l&apos;accueil
              </a>
              <button type="button" onClick={() => retry()} className={primaryAction}>
                <RotateCcw className="size-4" /> Réessayer
              </button>
            </>
          }
        >
          <p>Un problème inattendu empêche l&apos;affichage de l&apos;application. Réessayez dans un instant.</p>
          {digest && (
            <p className="mt-3 text-xs text-muted/80">
              Code de l&apos;erreur : <span className="font-mono text-foreground/80">{digest}</span>
            </p>
          )}
        </ErrorScreen>
      </body>
    </html>
  );
}
