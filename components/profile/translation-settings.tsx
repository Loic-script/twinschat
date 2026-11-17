"use client";

import { useState, useTransition } from "react";
import { Languages } from "lucide-react";
import { setTranslationEnabled } from "@/lib/actions/translate";
import { formatLanguages } from "@/lib/languages";
import type { Space } from "@/lib/types";

/**
 * Activation de la traduction des messages (profil admin et utilisateur).
 * Désactivée par défaut. Traduction par l'IA Mistral (serveur) si elle est configurée, sinon par le navigateur.
 */
export function TranslationSettings({
  space,
  enabled: initial,
  languages,
  server,
}: {
  space: Space;
  enabled: boolean;
  languages: string[];
  /** Traduction par l'IA Mistral (serveur) ; sinon par le navigateur. */
  server: boolean;
}) {
  const [enabled, setEnabled] = useState(initial);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      try {
        await setTranslationEnabled(space, next);
      } catch {
        setEnabled(!next);
      }
    });
  }

  return (
    <div className="flex items-start gap-4">
      <span className="hidden size-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2/70 text-accent-strong sm:inline-flex">
        <Languages className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Traduire les messages reçus</p>
        <p className="mt-1 text-sm text-muted">
          {enabled
            ? "Le bouton « Traduire » est disponible dans vos discussions."
            : "Désactivée : les messages restent dans leur langue d'origine."}
        </p>
        <p className="mt-2 text-xs text-muted">
          {languages.length > 0
            ? `Langues proposées : ${formatLanguages(languages)}.`
            : "Ajoutez dans vos informations une langue que la traduction prend en charge (ex. français, anglais)."}
          {" "}
          {server
            ? "Traduction par l'IA Mistral : les messages à traduire lui sont envoyés (une seule fois par langue)."
            : "Traduction gratuite faite par votre navigateur (Chrome sur ordinateur) : vos messages ne sont envoyés à aucun service externe."}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Traduire les messages reçus"
        disabled={pending}
        onClick={toggle}
        className={`relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-wait ${
          enabled ? "bg-accent" : "bg-surface-2 ring-1 ring-border"
        }`}
      >
        <span
          className={`inline-block size-5 rounded-full bg-foreground shadow transition-transform ${
            enabled ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
