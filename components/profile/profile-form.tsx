"use client";

import { useActionState, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { updateAdminProfile, type ProfileField, type ProfileState } from "@/app/admin/profil/actions";
import type { AdminProfile } from "@/lib/profile";

const initialState: ProfileState = { status: "idle" };

const FIELDS: { name: ProfileField; label: string; type: string; autoComplete: string; hint?: string; max: number }[] = [
  { name: "name", label: "Pseudo", type: "text", autoComplete: "nickname", hint: "Le nom affiché dans vos discussions.", max: 40 },
  { name: "email", label: "E-mail", type: "email", autoComplete: "email", max: 254 },
];

/** Pseudo et e-mail de l'admin. */
export function ProfileForm({ profile }: { profile: AdminProfile }) {
  const [state, formAction, pending] = useActionState(updateAdminProfile, initialState);
  const [dirty, setDirty] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [discarded, setDiscarded] = useState(false);

  // Nouvelle réponse du serveur : on réaffiche ce qui a été envoyé.
  useEffect(() => setDiscarded(false), [state]);

  useEffect(() => {
    if (state.status !== "success") return;
    setDirty(false);
    setShowSaved(true);
    const t = setTimeout(() => setShowSaved(false), 4000);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <form
      key={formKey}
      action={formAction}
      onChange={() => {
        setDirty(true);
        setShowSaved(false);
      }}
      noValidate
      className="grid gap-5 sm:grid-cols-2"
    >
      {FIELDS.map((f) => {
        const error = state.status === "error" ? state.errors?.[f.name] : undefined;
        const id = `profile-${f.name}`;
        const saved = f.name === "name" ? profile.name : profile.email;
        return (
          <div key={f.name}>
            <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground/90">
              {f.label}
            </label>
            <input
              id={id}
              name={f.name}
              type={f.type}
              required
              maxLength={f.max}
              autoComplete={f.autoComplete}
              defaultValue={!discarded && state.values ? state.values[f.name] : saved}
              aria-invalid={!!error}
              aria-describedby={error ? `${id}-error` : f.hint ? `${id}-hint` : undefined}
              className={`w-full rounded-xl border bg-surface-2/50 px-3.5 py-2.5 text-sm focus:outline-none ${
                error ? "border-rose-400/70 focus:border-rose-300" : "border-border focus:border-foreground/25"
              }`}
            />
            {error ? (
              <p id={`${id}-error`} className="mt-1.5 text-xs text-rose-300">
                {error}
              </p>
            ) : (
              f.hint && (
                <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
                  {f.hint}
                </p>
              )
            )}
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-end gap-3 sm:col-span-2">
        <p aria-live="polite" className="mr-auto text-sm">
          {state.status === "error" && <span className="text-rose-300">{state.message}</span>}
          {showSaved && (
            <span className="inline-flex items-center gap-1.5 text-accent-strong">
              <CheckCircle2 className="size-4" /> {state.message}
            </span>
          )}
        </p>
        <button
          type="button"
          disabled={!dirty || pending}
          onClick={() => {
            // Retour aux valeurs enregistrées (et non à la dernière saisie envoyée).
            setDiscarded(true);
            setFormKey((k) => k + 1);
            setDirty(false);
          }}
          className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={!dirty || pending}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-background shadow-lg shadow-accent/20 transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Enregistrer
        </button>
      </div>
    </form>
  );
}
