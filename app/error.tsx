"use client";

import { useEffect } from "react";
import Link from "next/link";
import { House, RotateCcw } from "lucide-react";
import { ErrorScreen, ILLUSTRATIONS, primaryAction, secondaryAction } from "@/components/errors/error-screen";

/**
 * Erreur inattendue dans une page (le reste de l'application reste chargé).
 * `retry` recharge la partie en erreur ; le code (digest) permet de retrouver l'erreur dans les journaux du serveur.
 */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";

  return (
    <ErrorScreen
      illustration={ILLUSTRATIONS.error}
      code="Erreur"
      title="La connexion a été interrompue"
      actions={
        <>
          <Link href="/" className={secondaryAction}>
            <House className="size-4" /> Retour à l&apos;accueil
          </Link>
          <button type="button" onClick={() => retry()} className={primaryAction}>
            <RotateCcw className="size-4" /> Réessayer
          </button>
        </>
      }
    >
      <p>Un problème inattendu est survenu de notre côté. Vos messages sont en sécurité : réessayez dans un instant.</p>
      {digest && (
        <p className="mt-3 text-xs text-muted/80">
          Code de l&apos;erreur : <span className="font-mono text-foreground/80">{digest}</span>
        </p>
      )}
    </ErrorScreen>
  );
}
