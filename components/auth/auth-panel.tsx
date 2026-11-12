"use client";

import { useActionState, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import {
  AlertCircle,
  ArrowBigUp,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  Mail,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { login, register, type AuthField, type AuthState } from "@/lib/actions/auth";

type Mode = "login" | "register";

const TABS: { mode: Mode; label: string }[] = [
  { mode: "login", label: "Connexion" },
  { mode: "register", label: "Inscription" },
];

const initialState: AuthState = {};

/**
 * Carte de connexion (admin et utilisateurs) et d'inscription des utilisateurs :
 * bordure lumineuse animée, halo qui suit la souris, onglets à pastille glissante.
 */
export function AuthPanel({ notice }: { notice?: string }) {
  const [mode, setMode] = useState<Mode>("login");
  const baseId = useId();
  const tabRefs = useRef<Record<Mode, HTMLButtonElement | null>>({ login: null, register: null });

  // Halo vert qui suit le pointeur dans la carte
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  // Flèches gauche/droite entre les onglets (motif ARIA des onglets)
  const onTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next: Mode =
      e.key === "Home" ? "login" : e.key === "End" ? "register" : mode === "login" ? "register" : "login";
    setMode(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div
      onPointerMove={onPointerMove}
      className="group/card relative rounded-[28px] bg-white/[0.07] p-px shadow-[0_30px_80px_-20px_rgba(0,0,0,0.75),0_0_60px_-25px_rgba(34,197,94,0.45)] motion-safe:animate-auth-in motion-safe:[animation-delay:120ms]"
    >
      {/* Bordure : un faisceau vert fait le tour de la carte */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
        <div className="absolute -inset-1/2 bg-[conic-gradient(from_0deg,transparent_0deg,transparent_250deg,rgba(74,222,128,0.85)_320deg,transparent_360deg)] motion-safe:animate-auth-border" />
      </div>

      <div className="relative overflow-hidden rounded-[27px] bg-[#091013]/[0.94] px-5 py-6 backdrop-blur-xl sm:px-8 sm:py-8 short:sm:py-6">
        {/* Halo qui suit la souris + reflet sur l'arête haute */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/card:opacity-100"
          style={{ background: "radial-gradient(380px circle at var(--mx, 50%) var(--my, 0px), rgba(34,197,94,0.11), transparent 65%)" }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-accent-strong/60 to-transparent" />

        <div className="relative">
          {/* Onglets : la pastille verte glisse vers l'onglet choisi */}
          <div
            role="tablist"
            aria-label="Authentification"
            onKeyDown={onTabKeyDown}
            className="relative grid grid-cols-2 rounded-2xl border border-white/[0.06] bg-black/30 p-1"
          >
            <span
              aria-hidden
              className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-xl bg-gradient-to-b from-[#34d36f] to-accent shadow-[0_6px_20px_-6px_rgba(34,197,94,0.8),inset_0_1px_0_rgba(255,255,255,0.35)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                mode === "register" ? "translate-x-full" : "translate-x-0"
              }`}
            />
            {TABS.map((tab) => {
              const selected = mode === tab.mode;
              return (
                <button
                  key={tab.mode}
                  ref={(el) => {
                    tabRefs.current[tab.mode] = el;
                  }}
                  id={`${baseId}-tab-${tab.mode}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`${baseId}-panel`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setMode(tab.mode)}
                  className={`relative z-10 rounded-xl py-2.5 text-sm font-semibold transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong ${
                    selected ? "text-[#03140a]" : "text-muted hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Le panneau glisse depuis le côté de l'onglet choisi */}
          <div
            key={mode}
            id={`${baseId}-panel`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${mode}`}
            className="mt-6 motion-safe:animate-auth-panel short:mt-5"
            style={{ "--auth-from": mode === "register" ? "18px" : "-18px" } as CSSProperties}
          >
            {/* Message après un retour de Google (annulation, échec, non configuré) */}
            {notice && (
              <p
                role="alert"
                className="mb-4 flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-200"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {notice}
              </p>
            )}
            {mode === "login" ? (
              <LoginForm onSwitch={() => setMode("register")} />
            ) : (
              <RegisterForm onSwitch={() => setMode("login")} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Apparition décalée des éléments d'un formulaire. */
const stagger = (i: number): CSSProperties => ({ animationDelay: `${80 + i * 55}ms` });
const STAGGER = "motion-safe:animate-stat-in";

/**
 * Après une erreur : la carte tremble légèrement et le curseur va dans le premier champ à corriger
 * (ou dans le mot de passe si les identifiants sont refusés).
 */
function useErrorFeedback(state: AuthState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const form = ref.current;
    if (!form || (!state.message && !state.errors)) return;
    const target =
      form.querySelector<HTMLInputElement>('[aria-invalid="true"]') ??
      form.querySelector<HTMLInputElement>('input[name="password"]');
    target?.focus();
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      form.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-8px)" },
          { transform: "translateX(6px)" },
          { transform: "translateX(-4px)" },
          { transform: "translateX(2px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 450, easing: "ease-out" },
      );
    }
  }, [state]);
  return ref;
}

function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const [state, formAction, pending] = useActionState(login, initialState);
  const formRef = useErrorFeedback(state);
  return (
    <form ref={formRef} action={formAction} className="space-y-4 short:space-y-3">
      <div className={STAGGER} style={stagger(0)}>
        <EmailField state={state} enterKeyHint="next" />
      </div>
      <div className={STAGGER} style={stagger(1)}>
        <PasswordField state={state} name="password" label="Mot de passe" autoComplete="current-password" enterKeyHint="go" />
      </div>
      <FormMessage state={state} />
      <div className={`pt-1 ${STAGGER}`} style={stagger(2)}>
        <SubmitButton pending={pending} icon={LogIn} label="Se connecter" pendingLabel="Connexion…" />
      </div>
      <div className={STAGGER} style={stagger(3)}>
        <GoogleSignIn />
      </div>
      <div className={STAGGER} style={stagger(4)}>
        <SwitchLine text="Pas encore de compte ?" action="Créer un compte" onClick={onSwitch} />
      </div>
    </form>
  );
}

function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
  const [state, formAction, pending] = useActionState(register, initialState);
  const formRef = useErrorFeedback(state);
  const [password, setPassword] = useState("");
  return (
    <form ref={formRef} action={formAction} className="space-y-4 short:space-y-3">
      <div className={STAGGER} style={stagger(0)}>
        <EmailField state={state} enterKeyHint="next" />
      </div>
      <div className={STAGGER} style={stagger(1)}>
        <PasswordField
          state={state}
          name="password"
          label="Mot de passe"
          autoComplete="new-password"
          enterKeyHint="next"
          hint="8 caractères minimum, avec au moins une lettre et un chiffre."
          meter
          onValueChange={setPassword}
        />
      </div>
      <div className={STAGGER} style={stagger(2)}>
        <PasswordField
          state={state}
          name="confirm"
          label="Confirmer le mot de passe"
          autoComplete="new-password"
          enterKeyHint="done"
          matchWith={password}
        />
      </div>
      <FormMessage state={state} />
      <div className={`pt-1 ${STAGGER}`} style={stagger(3)}>
        <SubmitButton pending={pending} icon={UserPlus} label="Créer mon compte" pendingLabel="Création du compte…" />
      </div>
      <div className={STAGGER} style={stagger(4)}>
        <GoogleSignIn />
      </div>
      <div className={STAGGER} style={stagger(5)}>
        <SwitchLine text="Déjà inscrit ?" action="Se connecter" onClick={onSwitch} />
      </div>
    </form>
  );
}

const inputClass = (error?: string) =>
  `h-12 w-full rounded-xl border bg-white/[0.03] pl-11 text-base text-foreground transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted/50 hover:bg-white/[0.045] focus:bg-white/[0.05] focus:outline-none sm:text-[15px] ${
    error
      ? "border-rose-400/60 focus:border-rose-300/80 focus:shadow-[0_0_0_4px_rgba(251,113,133,0.14)]"
      : "border-white/[0.09] focus:border-accent/70 focus:shadow-[0_0_0_4px_rgba(34,197,94,0.15),0_0_24px_-6px_rgba(34,197,94,0.45)]"
  }`;

/** Icône à gauche du champ : grise, elle passe au vert quand le champ est actif. */
function FieldIcon({ icon: Icon, error }: { icon: LucideIcon; error?: string }) {
  return (
    <Icon
      aria-hidden
      className={`pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 transition-colors duration-200 ${
        error ? "text-rose-300/80" : "text-muted/70 group-focus-within/field:text-accent-strong"
      }`}
    />
  );
}

function FieldError({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error) {
    return (
      <p id={id} className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-300">
        <AlertCircle className="size-3.5 shrink-0" />
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
      <div className="group/field relative">
        <FieldIcon icon={Mail} error={error} />
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
          className={`${inputClass(error)} pr-3.5`}
        />
      </div>
      <FieldError id="email-error" error={error} />
    </div>
  );
}

/** Robustesse indicative du mot de passe (0 à 4). */
function passwordStrength(value: string) {
  let score = 0;
  if (value.length >= 8) score++;
  if (/\p{L}/u.test(value) && /\d/.test(value)) score++;
  if (value.length >= 12) score++;
  if (/[^\p{L}\d]/u.test(value) || (/\p{Lu}/u.test(value) && /\p{Ll}/u.test(value))) score++;
  return score;
}

const STRENGTH = [
  { label: "Trop faible", bar: "bg-rose-400", text: "text-rose-300" },
  { label: "Faible", bar: "bg-amber-400", text: "text-amber-300" },
  { label: "Correct", bar: "bg-lime-400", text: "text-lime-300" },
  { label: "Solide", bar: "bg-accent", text: "text-accent-strong" },
  { label: "Excellent", bar: "bg-accent-strong", text: "text-accent-strong" },
];

function StrengthMeter({ value }: { value: string }) {
  const score = passwordStrength(value);
  const level = STRENGTH[score];
  const filled = Math.max(1, score);
  return (
    <div className="mt-2 flex items-center gap-3">
      <div className="grid flex-1 grid-cols-4 gap-1.5" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`h-1 rounded-full transition-colors duration-300 ${i <= filled ? level.bar : "bg-white/10"}`}
          />
        ))}
      </div>
      <span aria-live="polite" className={`w-20 text-right text-xs font-medium ${level.text}`}>
        {level.label}
      </span>
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
  meter = false,
  matchWith,
  onValueChange,
}: {
  state: AuthState;
  name: Exclude<AuthField, "email">;
  label: string;
  autoComplete: "current-password" | "new-password";
  enterKeyHint: "next" | "go" | "done";
  hint?: string;
  /** Affiche la jauge de robustesse pendant la saisie. */
  meter?: boolean;
  /** Valeur à retrouver (confirmation) : une coche verte apparaît quand les deux correspondent. */
  matchWith?: string;
  onValueChange?: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const [capsLock, setCapsLock] = useState(false);
  // Le formulaire est vidé après chaque envoi : on oublie aussi la valeur suivie.
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    setValue("");
  }
  useEffect(() => {
    onValueChange?.("");
  }, [state, onValueChange]);

  const error = state.errors?.[name];
  const id = name === "confirm" ? "confirm-password" : autoComplete;
  const describedBy = error || hint ? `${id}-help` : undefined;
  const matches = matchWith !== undefined && value.length > 0 && value === matchWith;
  const checkCaps = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState("CapsLock"));

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground/90">
        {label}
      </label>
      <div className="group/field relative">
        <FieldIcon icon={Lock} error={error} />
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
          onChange={(e) => {
            setValue(e.target.value);
            onValueChange?.(e.target.value);
          }}
          onKeyDown={checkCaps}
          onKeyUp={checkCaps}
          onBlur={() => setCapsLock(false)}
          className={`${inputClass(error)} ${matches ? "pr-20" : "pr-12"}`}
        />
        {matches && (
          <span className="pointer-events-none absolute inset-y-0 right-11 inline-flex items-center text-accent-strong motion-safe:animate-badge-in">
            <Check className="size-4" strokeWidth={3} aria-hidden />
            <span className="sr-only">Les mots de passe correspondent</span>
          </span>
        )}
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center rounded-r-xl text-muted transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
        >
          {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
        </button>
      </div>
      {capsLock && (
        <p aria-live="polite" className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-300">
          <ArrowBigUp className="size-3.5" aria-hidden />
          Verrouillage majuscule activé
        </p>
      )}
      {meter && value.length > 0 && !error && <StrengthMeter value={value} />}
      <FieldError id={`${id}-help`} error={error} hint={hint} />
    </div>
  );
}

function FormMessage({ state }: { state: AuthState }) {
  if (!state.message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-200 motion-safe:animate-stat-in"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      {state.message}
    </p>
  );
}

function SubmitButton({
  pending,
  icon: Icon,
  label,
  pendingLabel,
}: {
  pending: boolean;
  icon: LucideIcon;
  label: string;
  pendingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="group/btn relative isolate inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-b from-[#34d36f] to-[#16a34a] px-5 text-[15px] font-semibold text-[#03140a] shadow-[0_12px_30px_-12px_rgba(34,197,94,0.85),inset_0_1px_0_rgba(255,255,255,0.35)] transition duration-200 hover:shadow-[0_16px_40px_-12px_rgba(34,197,94,1),inset_0_1px_0_rgba(255,255,255,0.45)] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong active:scale-[0.985] disabled:cursor-wait disabled:brightness-90"
    >
      {/* Reflet qui traverse le bouton au survol */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/45 to-transparent opacity-0 group-hover/btn:opacity-100 motion-safe:group-hover/btn:animate-auth-shine"
      />
      {pending ? <Loader2 className="size-[18px] animate-spin" /> : <Icon className="size-[18px]" />}
      <span>{pending ? pendingLabel : label}</span>
      {!pending && (
        <ArrowRight className="size-4 -translate-x-1 opacity-0 transition duration-300 group-hover/btn:translate-x-0 group-hover/btn:opacity-100" />
      )}
    </button>
  );
}

/** Logo « G » officiel de Google (4 couleurs). */
function GoogleLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * Séparateur « ou » + « Continuer avec Google » (connexion ou inscription : Google retrouve le compte
 * par son adresse, ou en crée un). Lien classique : la page part vers Google.
 */
function GoogleSignIn() {
  const [pending, setPending] = useState(false);
  // Retour arrière depuis Google (cache du navigateur) : le bouton redevient cliquable.
  useEffect(() => {
    const reset = () => setPending(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3 text-xs text-muted/70 short:mb-3" aria-hidden>
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
        ou
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
      </div>
      <a
        href="/api/auth/google"
        onClick={() => setPending(true)}
        aria-busy={pending}
        className={`group/google relative inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/[0.1] bg-white/[0.04] text-[15px] font-semibold text-foreground transition duration-200 hover:border-white/[0.18] hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong active:scale-[0.985] short:h-11 ${
          pending ? "pointer-events-none opacity-70" : ""
        }`}
      >
        {pending ? (
          <Loader2 className="size-[18px] animate-spin" aria-hidden />
        ) : (
          <span className="grid size-6 place-items-center rounded-full bg-white shadow-sm transition-transform duration-300 group-hover/google:scale-110">
            <GoogleLogo className="size-3.5" />
          </span>
        )}
        {pending ? "Redirection vers Google…" : "Continuer avec Google"}
      </a>
    </div>
  );
}

function SwitchLine({ text, action, onClick }: { text: string; action: string; onClick: () => void }) {
  return (
    <p className="text-center text-sm text-muted">
      {text}{" "}
      <button
        type="button"
        onClick={onClick}
        className="relative font-semibold text-accent-strong after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-accent-strong after:transition-transform after:duration-300 hover:after:scale-x-100 focus-visible:after:scale-x-100 focus-visible:outline-none"
      >
        {action}
      </button>
    </p>
  );
}
