"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { secondaryAction } from "./error-screen";

/** « Page précédente » : retour dans l'historique, ou vers l'accueil s'il n'y a pas de page avant. */
export function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
      className={secondaryAction}
    >
      <ArrowLeft className="size-4" /> Page précédente
    </button>
  );
}
