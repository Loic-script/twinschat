import type { Metadata } from "next";
import Link from "next/link";
import { House } from "lucide-react";
import { BackButton } from "@/components/errors/back-button";
import { ErrorScreen, ILLUSTRATIONS, primaryAction } from "@/components/errors/error-screen";

export const metadata: Metadata = { title: "Page introuvable", robots: { index: false } };

/** Page 404 : lien cassé ou adresse mal saisie. */
export default function NotFound() {
  return (
    <ErrorScreen
      illustration={ILLUSTRATIONS.notFound}
      code="Erreur 404"
      title="Page introuvable"
      actions={
        <>
          <BackButton />
          <Link href="/" className={primaryAction}>
            <House className="size-4" /> Retour à l&apos;accueil
          </Link>
        </>
      }
    >
      Notre robot a cherché partout : cette page n&apos;existe pas ou a été déplacée. Vérifiez l&apos;adresse, ou revenez à vos discussions.
    </ErrorScreen>
  );
}
