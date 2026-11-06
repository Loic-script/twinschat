"use client";

import { useActionState, useId, useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2, LogIn, UserPlus } from "lucide-react";
import { login, register, type AuthField, type AuthState } from "@/lib/actions/auth";

type Mode = "login" | "register";

const TABS: { mode: Mode; label: string }[] = [
  { mode: "login", label: "Connexion" },
  { mode: "register", label: "Inscription" },
];

const initialState: AuthState = {};

/** Connexion (admin et utilisateurs) et inscription des utilisateurs, dans un même panneau à onglets. */
export function AuthPanel() {
  const [mode, setMode] = useState<Mode>("login");
  const baseId = useId();

  return (
    <div>
      <div role="tablist" aria-label="Authentification" className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2/60 p-1">
        {TABS.map((tab) => {
          const selected = mode === tab.mode;
          return (
            <button
              key={tab.mode}
              id={`${baseId}-tab-${tab.mode}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              onClick={() => setMode(tab.mode)}
              className={`rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                selected ? "bg-accent text-background shadow-lg shadow-accent/20" : "text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${mode}`} className="mt-6">
        {mode === "login" ? <LoginForm onSwitch={() => setMode("register")} /> : <RegisterForm onSwitch={() => setMode("login")} />}
      </div>
    </div>
  );
}

function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const [state, formAction, pending] = useActionState(login, initialState);
  return (
    <form action={formAction} className="space-y-4">
      <EmailField state={state} enterKeyHint="next" />
      <PasswordField state={state} name="password" label="Mot de passe" autoComplete="current-password" enterKeyHint="go" />
      <FormMessage state={state} />
      <SubmitButton pending={pending} icon={LogIn} label="Se connecter" />
      <SwitchLine text="Pas encore de compte ?" action="Créer un compte" onClick={onSwitch} />
    </form>
  );
}

function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
  const [state, formAction, pending] = useActionState(register, initialState);
  return (
    <form action={formAction} className="space-y-4">
      <EmailField state={state} enterKeyHint="next" />
      <PasswordField
        state={state}
        name="password"
        label="Mot de passe"
        autoComplete="new-password"
        enterKeyHint="next"
        hint="8 caractères minimum, avec au moins une lettre et un chiffre."
      />
      <PasswordField state={state} name="confirm" label="Confirmer le mot de passe" autoComplete="new-password" enterKeyHint="done" />
      <FormMessage state={state} />
      <SubmitButton pending={pending} icon={UserPlus} label="Créer mon compte" />
      <SwitchLine text="Déjà inscrit ?" action="Se connecter" onClick={onSwitch} />
    </form>
  );
}

const inputClass = (error?: string) =>
  `w-full rounded-xl border bg-surface-2/50 px-3.5 py-2.5 text-sm placeholder:text-muted/60 focus:outline-none ${
    error ? "border-rose-400/70 focus:border-rose-300" : "border-border focus:border-foreground/25"
  }`;

function FieldError({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error) {
    return (
      <p id={id} className="mt-1.5 text-xs text-rose-300">
        {error}
      </p>
    );
  }
  return hint ? (
    <p id={id} className="mt-1.5 text-xs text-muted">
      {hint}
    </p>
  ) : null;
}

function EmailField({ state, enterKeyHint }: { state: AuthState; enterKeyHint: "next" }) {
  const error = state.errors?.email;
  return (
    <div>
      <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground/90">
        E-mail
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        spellCheck={false}
        enterKeyHint={enterKeyHint}
        required
        maxLength={254}
        // Conservé après une erreur (le formulaire est réinitialisé à chaque envoi).
        defaultValue={state.email}
        placeholder="vous@exemple.com"
        aria-invalid={!!error}
        aria-describedby={error ? "email-error" : undefined}
        className={inputClass(error)}
      />
      <FieldError id="email-error" error={error} />
    </div>
  );
}

function PasswordField({
  state,
  name,
  label,
  autoComplete,
  enterKeyHint,
  hint,
}: {
  state: AuthState;
  name: Exclude<AuthField, "email">;
  label: string;
  autoComplete: "current-password" | "new-password";
  enterKeyHint: "next" | "go" | "done";
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  const error = state.errors?.[name];
  const id = name === "confirm" ? "confirm-password" : autoComplete;
  const describedBy = error || hint ? `${id}-help` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground/90">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          enterKeyHint={enterKeyHint}
          required
          maxLength={128}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={`${inputClass(error)} pr-11`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-xl text-muted transition-colors hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <FieldError id={`${id}-help`} error={error} hint={hint} />
    </div>
  );
}

function FormMessage({ state }: { state: AuthState }) {
  if (!state.message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-200">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      {state.message}
    </p>
  );
}

function SubmitButton({ pending, icon: Icon, label }: { pending: boolean; icon: typeof LogIn; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-background shadow-lg shadow-accent/20 transition hover:bg-accent-strong disabled:opacity-60"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
      {label}
    </button>
  );
}

function SwitchLine({ text, action, onClick }: { text: string; action: string; onClick: () => void }) {
  return (
    <p className="pt-1 text-center text-sm text-muted">
      {text}{" "}
      <button type="button" onClick={onClick} className="font-semibold text-accent-strong hover:underline">
        {action}
      </button>
    </p>
  );
}
