"use client";

import type { Space } from "@/lib/types";
import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { changePassword, type PasswordField, type PasswordState } from "@/lib/actions/account";

const initialState: PasswordState = { status: "idle" };

/** Changement (ou première définition) du mot de passe du compte connecté. */
export function PasswordForm({ hasPassword, space }: { hasPassword: boolean; space: Space }) {
  const [state, formAction, pending] = useActionState(changePassword, initialState);
  const [visible, setVisible] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status !== "success") return;
    formRef.current?.reset();
    setShowDone(true);
    const t = setTimeout(() => setShowDone(false), 4000);
    return () => clearTimeout(t);
  }, [state]);

  const fields: { name: PasswordField; label: string; autoComplete: string }[] = [
    ...(hasPassword ? [{ name: "current" as const, label: "Mot de passe actuel", autoComplete: "current-password" }] : []),
    { name: "next", label: "Nouveau mot de passe", autoComplete: "new-password" },
    { name: "confirm", label: "Confirmer le nouveau mot de passe", autoComplete: "new-password" },
  ];

  return (
    <form ref={formRef} action={formAction} noValidate className="grid gap-5 sm:grid-cols-2">
      <input type="hidden" name="space" value={space} />
      {fields.map((f) => {
        const error = state.status === "error" ? state.errors?.[f.name] : undefined;
        const id = `password-${f.name}`;
        return (
          <div key={f.name} className={f.name === "current" ? "sm:col-span-2" : undefined}>
            <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground/90">
              {f.label}
            </label>
            <input
              id={id}
              name={f.name}
              type={visible ? "text" : "password"}
              autoComplete={f.autoComplete}
              maxLength={128}
              aria-invalid={!!error}
              aria-describedby={error ? `${id}-error` : undefined}
              className={`w-full rounded-xl border bg-surface-2/50 px-3.5 py-2.5 text-sm focus:outline-none ${
                error ? "border-rose-400/70 focus:border-rose-300" : "border-border focus:border-foreground/25"
              }`}
            />
            {error && (
              <p id={`${id}-error`} className="mt-1.5 text-xs text-rose-300">
                {error}
              </p>
            )}
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-end gap-3 sm:col-span-2">
        <p aria-live="polite" className="mr-auto text-sm">
          {state.status === "error" && <span className="text-rose-300">{state.message}</span>}
          {showDone && (
            <span className="inline-flex items-center gap-1.5 text-accent-strong">
              <CheckCircle2 className="size-4" /> {state.message}
            </span>
          )}
          {state.status === "idle" && <span className="text-xs text-muted">8 caractères minimum, avec au moins une lettre et un chiffre.</span>}
        </p>
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface-2"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {visible ? "Masquer" : "Afficher"}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-background shadow-lg shadow-accent/20 transition hover:bg-accent-strong disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          {hasPassword ? "Changer le mot de passe" : "Définir le mot de passe"}
        </button>
      </div>
    </form>
  );
}
