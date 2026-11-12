"use client";

import { useActionState, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Camera,
  Check,
  ChevronDown,
  ImagePlus,
  Loader2,
  LogOut,
} from "lucide-react";
import { saveOnboarding, type AccountType, type OnboardingField, type OnboardingState } from "@/app/bienvenue/actions";
import { LanguagePicker } from "@/components/espace/language-picker";
import { CountrySelect } from "./country-select";
import { logout } from "@/lib/actions/auth";

type Values = {
  name: string;
  phone: string;
  company: string;
  jobTitle: string;
  country: string;
  city: string;
  website: string;
  languages: string[];
};

const STEPS = [{ label: "Profil" }, { label: "Activité" }, { label: "Photo" }];

const TYPES: { value: AccountType; label: string }[] = [
  { value: "client", label: "Client" },
  { value: "entreprise", label: "Entreprise" },
  { value: "autre", label: "Autre" },
];


const STEP1_FIELDS: OnboardingField[] = ["type", "name", "phone", "country", "city"];
const PHONE_RE = /^\+?[\d\s().-]{6,}$/;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024;

const initialState: OnboardingState = { status: "idle" };

/**
 * Parcours d'accueil en 3 étapes après l'inscription :
 * 1. type de compte (client, entreprise, autre), nom, téléphone ;
 * 2. activité (entreprise, poste, pays, ville, langues) — enregistrement ;
 * 3. photo de profil ou logo (facultatif), puis accès à l'espace.
 */
export function OnboardingWizard({
  initial,
  email,
  startStep = 1,
  isCompanyAccount = false,
}: {
  initial: Values;
  email: string;
  /** 3 : profil déjà enregistré, il ne reste que la photo (page rechargée). */
  startStep?: 1 | 3;
  isCompanyAccount?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<number>(startStep);
  const [dir, setDir] = useState<1 | -1>(1);
  const [type, setType] = useState<AccountType | null>(startStep === 3 && isCompanyAccount ? "entreprise" : null);
  const [values, setValues] = useState<Values>(initial);
  const [localErrors, setLocalErrors] = useState<Partial<Record<OnboardingField, string>>>({});
  const [state, formAction, pending] = useActionState(saveOnboarding, initialState);
  const cardRef = useRef<HTMLDivElement>(null);

  const isCompany = type === "entreprise";
  const errors = { ...(state.status === "error" ? state.errors : {}), ...localErrors };

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
    cardRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  // Réponse du serveur : étape suivante, ou retour à l'étape qui contient l'erreur.
  useEffect(() => {
    if (state.status === "success") {
      setDir(1);
      setStep(3);
    } else if (state.status === "error" && state.errors && STEP1_FIELDS.some((f) => state.errors?.[f])) {
      setDir(-1);
      setStep(1);
    }
  }, [state]);

  const set = (field: keyof Omit<Values, "languages">) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setLocalErrors((er) => ({ ...er, [field]: undefined }));
  };

  function continueFromStep1() {
    const found: Partial<Record<OnboardingField, string>> = {};
    if (!type) found.type = "Choisissez le type de compte.";
    if (values.name.trim().length < 2) found.name = "Indiquez votre nom (2 caractères minimum).";
    if (values.phone.trim() && !PHONE_RE.test(values.phone.trim())) found.phone = "Numéro de téléphone invalide.";
    if (!values.country) found.country = "Choisissez votre pays.";
    setLocalErrors(found);
    if (Object.keys(found).length === 0) go(2);
  }

  return (
    <div
      ref={cardRef}
      className="relative rounded-[28px] bg-white/[0.07] p-px shadow-[0_30px_80px_-20px_rgba(0,0,0,0.75),0_0_60px_-25px_rgba(34,197,94,0.45)] motion-safe:animate-auth-in motion-safe:[animation-delay:120ms]"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
        <div className="absolute -inset-1/2 bg-[conic-gradient(from_0deg,transparent_0deg,transparent_250deg,rgba(74,222,128,0.85)_320deg,transparent_360deg)] motion-safe:animate-auth-border" />
      </div>

      {/* Pas d'overflow-hidden ici : les listes déroulantes (type, pays) peuvent dépasser de la carte */}
      <div className="relative rounded-[27px] bg-[#091013]/[0.94] px-5 py-6 backdrop-blur-xl sm:px-8 sm:py-7">
        <div aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-accent-strong/60 to-transparent" />

        <Stepper step={step} />

        {/* Étapes 1 et 2 : un seul formulaire (les champs restent en mémoire d'une étape à l'autre) */}
        <form
          action={formAction}
          noValidate
          className={step === 3 ? "hidden" : undefined}
          onSubmit={(e) => {
            // Pays obligatoire (étape 1) : vérifié avant l'envoi, et de nouveau côté serveur
            if (!values.country) {
              e.preventDefault();
              setLocalErrors((er) => ({ ...er, country: "Choisissez votre pays." }));
              go(1);
            }
          }}
        >
          <StepPanel visible={step === 1} dir={dir}>
            <StepTitle title="Parlez-nous de vous" />

            <div>
              <label id="onb-type-label" htmlFor="onb-type" className="mb-1.5 block text-sm font-medium text-foreground/90">
                Vous êtes
              </label>
              <TypeSelect
                value={type}
                error={errors.type}
                onChange={(v) => {
                  setType(v);
                  setLocalErrors((er) => ({ ...er, type: undefined, company: undefined }));
                }}
              />
              <FieldError id="type-error" error={errors.type} />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <TextField
                id="name"
                label={isCompany ? "Personne de contact" : "Nom et prénom"}
                value={values.name}
                onChange={set("name")}
                error={errors.name}
                autoComplete="name"
                maxLength={80}
              />
              <TextField
                id="phone"
                label="Téléphone"
                optional
                type="tel"
                value={values.phone}
                onChange={set("phone")}
                error={errors.phone}
                autoComplete="tel"
                placeholder="+261 34 00 000 00"
                maxLength={30}
              />
              <div>
                <label htmlFor="onb-country" className="mb-1.5 block text-sm font-medium text-foreground/90">
                  Pays
                </label>
                <CountrySelect
                  id="onb-country"
                  name="country"
                  value={values.country}
                  error={errors.country}
                  onChange={(country) => {
                    setValues((v) => ({ ...v, country }));
                    setLocalErrors((er) => ({ ...er, country: undefined }));
                  }}
                />
                <FieldError id="onb-country-error" error={errors.country} />
              </div>
              <TextField
                id="city"
                label="Ville"
                optional
                value={values.city}
                onChange={set("city")}
                error={errors.city}
                autoComplete="address-level2"
                placeholder="Ex. Antananarivo"
                maxLength={80}
              />
            </div>

            <Actions>
              <span className="truncate text-xs text-muted">Connecté avec {email}</span>
              <PrimaryButton type="button" onClick={continueFromStep1}>
                Continuer <ArrowRight className="size-4" />
              </PrimaryButton>
            </Actions>
          </StepPanel>

          <StepPanel visible={step === 2} dir={dir}>
            <StepTitle title={isCompany ? "Votre entreprise" : "Votre activité"} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="company"
                label={isCompany ? "Nom de l'entreprise" : "Entreprise ou organisation"}
                optional={!isCompany}
                value={values.company}
                onChange={set("company")}
                error={errors.company}
                autoComplete="organization"
                maxLength={80}
              />
              <TextField
                id="jobTitle"
                label="Poste"
                optional
                value={values.jobTitle}
                onChange={set("jobTitle")}
                error={errors.jobTitle}
                autoComplete="organization-title"
                placeholder="Ex. Responsable marketing"
                maxLength={80}
              />
              <div className="sm:col-span-2">
                <TextField
                  id="website"
                  label="Site web"
                  optional
                  type="url"
                  inputMode="url"
                  value={values.website}
                  onChange={set("website")}
                  error={errors.website}
                  autoComplete="url"
                  spellCheck={false}
                  placeholder="Ex. monsite.com"
                  maxLength={200}
                />
              </div>
            </div>
            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-medium text-foreground/90">
                Langues parlées <span className="font-normal text-muted">(facultatif)</span>
              </legend>
              <LanguagePicker defaultValue={values.languages} />
            </fieldset>

            {state.status === "error" && state.message && !STEP1_FIELDS.some((f) => state.errors?.[f]) && (
              <p role="alert" className="mt-4 flex items-center gap-2 text-sm text-rose-300">
                <AlertCircle className="size-4 shrink-0" /> {state.message}
              </p>
            )}

            <Actions>
              <SecondaryButton type="button" onClick={() => go(1)} disabled={pending}>
                <ArrowLeft className="size-4" /> Retour
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                {pending ? "Enregistrement…" : "Continuer"}
                {!pending && <ArrowRight className="size-4" />}
              </PrimaryButton>
            </Actions>
          </StepPanel>
        </form>

        {step === 3 && (
          <StepPanel visible dir={dir}>
            <PhotoStep isCompany={isCompany} name={values.name} onDone={() => router.push("/user")} />
          </StepPanel>
        )}

        {step < 3 && (
          <form action={logout} className="mt-5 text-center">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 text-xs text-muted/80 transition-colors hover:text-foreground"
            >
              <LogOut className="size-3.5" /> Ce n&apos;est pas vous ? Se déconnecter
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * Sélecteur du type de compte (liste déroulante sur mesure) :
 * clic ou clavier (flèches, Entrée, Échap, Début/Fin, première lettre), fermeture au clic extérieur.
 * La valeur part avec le formulaire dans le champ caché `type`.
 */
function TypeSelect({
  value,
  error,
  onChange,
}: {
  value: AccountType | null;
  error?: string;
  onChange: (value: AccountType) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = TYPES.find((t) => t.value === value) ?? null;

  // Fermeture au clic en dehors
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  const openList = () => {
    setActive(Math.max(0, TYPES.findIndex((t) => t.value === value)));
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };
  const choose = (i: number) => {
    onChange(TYPES[i].value);
    close();
  };

  const onListKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const last = TYPES.length - 1;
    if (e.key === "ArrowDown") setActive((a) => (a >= last ? 0 : a + 1));
    else if (e.key === "ArrowUp") setActive((a) => (a <= 0 ? last : a - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(last);
    else if (e.key === "Enter" || e.key === " ") choose(active);
    else if (e.key === "Escape") close();
    else if (e.key === "Tab") return setOpen(false);
    else if (e.key.length === 1) {
      // Saut à l'option qui commence par la lettre tapée
      const i = TYPES.findIndex((t) => t.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (i >= 0) setActive(i);
      else return;
    } else return;
    e.preventDefault();
  };

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name="type" value={value ?? ""} />
      <button
        ref={buttonRef}
        id="onb-type"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="onb-type-list"
        aria-invalid={!!error}
        aria-describedby={error ? "type-error" : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
            e.preventDefault();
            openList();
          }
        }}
        className={`group flex h-12 w-full items-center gap-3 rounded-xl border bg-white/[0.03] px-3.5 text-left transition-[border-color,box-shadow,background-color] duration-200 hover:bg-white/[0.045] focus:outline-none ${
          error
            ? "border-rose-400/60 focus-visible:shadow-[0_0_0_4px_rgba(251,113,133,0.14)]"
            : open
              ? "border-accent/70 bg-white/[0.05] shadow-[0_0_0_4px_rgba(34,197,94,0.15),0_0_24px_-6px_rgba(34,197,94,0.45)]"
              : "border-white/[0.09] focus-visible:border-accent/70 focus-visible:shadow-[0_0_0_4px_rgba(34,197,94,0.15)]"
        }`}
      >
        <span className={`min-w-0 flex-1 truncate text-base sm:text-[15px] ${selected ? "font-medium" : "text-muted/60"}`}>
          {selected ? selected.label : "Choisissez le type de compte"}
        </span>
        <ChevronDown
          aria-hidden
          className={`size-[18px] shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            open ? "rotate-180 text-accent-strong" : "text-muted group-hover:text-foreground"
          }`}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id="onb-type-list"
          role="listbox"
          tabIndex={-1}
          aria-labelledby="onb-type-label"
          aria-activedescendant={`onb-type-${TYPES[active].value}`}
          onKeyDown={onListKeyDown}
          className="absolute inset-x-0 top-full z-30 mt-2 origin-top rounded-2xl border border-white/[0.1] bg-[#0b1316] p-1.5 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85),0_0_40px_-18px_rgba(34,197,94,0.55)] focus:outline-none motion-safe:animate-select-in"
        >
          {TYPES.map((t, i) => {
            const isSelected = t.value === value;
            const isActive = i === active;
            return (
              <li
                key={t.value}
                id={`onb-type-${t.value}`}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 motion-safe:animate-stat-in ${
                  isActive ? "bg-white/[0.07]" : ""
                } ${isSelected ? "text-accent-strong" : "text-foreground/90"}`}
                style={{ animationDelay: `${40 + i * 40}ms` }}
              >
                <span className="min-w-0 flex-1 text-[15px] font-medium">{t.label}</span>
                {isSelected && <Check className="size-4 shrink-0 text-accent-strong" strokeWidth={3} aria-hidden />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Indicateur des 3 étapes : pastilles reliées par une barre qui se remplit. */
function Stepper({ step }: { step: number }) {
  return (
    <nav aria-label="Étapes" className="mb-6">
      <p className="sr-only" aria-live="polite">
        Étape {step} sur {STEPS.length} : {STEPS[step - 1].label}
      </p>
      <ol className="relative flex items-start justify-between">
        <span aria-hidden className="absolute top-4 right-[16%] left-[16%] h-0.5 rounded-full bg-white/10" />
        <span
          aria-hidden
          className="absolute top-4 left-[16%] h-0.5 rounded-full bg-gradient-to-r from-accent-strong to-accent shadow-[0_0_10px_rgba(34,197,94,0.7)] transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ width: `${((step - 1) / (STEPS.length - 1)) * 68}%` }}
        />
        {STEPS.map((s, i) => {
          const n = i + 1;
          const done = n < step;
          const current = n === step;
          return (
            <li key={s.label} className="relative z-10 flex w-1/3 flex-col items-center gap-1.5" aria-current={current ? "step" : undefined}>
              <span
                className={`grid size-8 place-items-center rounded-full text-sm font-semibold transition-all duration-500 ${
                  done
                    ? "bg-accent text-[#03140a]"
                    : current
                      ? "bg-[#091013] text-accent-strong ring-2 ring-accent shadow-[0_0_18px_-2px_rgba(34,197,94,0.8)]"
                      : "bg-[#0d1518] text-muted ring-1 ring-white/10"
                }`}
              >
                {done ? <Check className="size-4" strokeWidth={3} /> : n}
              </span>
              <span className={`text-xs font-medium transition-colors ${current || done ? "text-foreground" : "text-muted"}`}>
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Contenu d'une étape : reste dans la page (valeurs gardées), glisse à l'apparition. */
function StepPanel({ visible, dir, children }: { visible: boolean; dir: 1 | -1; children: ReactNode }) {
  return (
    <div
      hidden={!visible}
      className="motion-safe:animate-auth-panel"
      style={{ "--auth-from": `${dir * 22}px` } as CSSProperties}
    >
      {children}
    </div>
  );
}

function StepTitle({ title, text }: { title: string; text?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {text && <p className="mt-1 text-sm text-muted">{text}</p>}
    </div>
  );
}

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-300">
      <AlertCircle className="size-3.5 shrink-0" /> {error}
    </p>
  );
}

function TextField({
  id,
  label,
  optional = false,
  error,
  ...input
}: {
  id: OnboardingField;
  label: string;
  optional?: boolean;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={`onb-${id}`} className="mb-1.5 block text-sm font-medium text-foreground/90">
        {label} {optional && <span className="font-normal text-muted">(facultatif)</span>}
      </label>
      <input
        id={`onb-${id}`}
        name={id}
        aria-invalid={!!error}
        aria-describedby={error ? `onb-${id}-error` : undefined}
        className={`h-12 w-full rounded-xl border bg-white/[0.03] px-3.5 text-base transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted/50 hover:bg-white/[0.045] focus:bg-white/[0.05] focus:outline-none sm:text-[15px] ${
          error
            ? "border-rose-400/60 focus:border-rose-300/80 focus:shadow-[0_0_0_4px_rgba(251,113,133,0.14)]"
            : "border-white/[0.09] focus:border-accent/70 focus:shadow-[0_0_0_4px_rgba(34,197,94,0.15),0_0_24px_-6px_rgba(34,197,94,0.45)]"
        }`}
        {...input}
      />
      <FieldError id={`onb-${id}-error`} error={error} />
    </div>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-7 flex items-center justify-between gap-3">{children}</div>;
}

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="group/btn relative ml-auto inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-b from-[#34d36f] to-[#16a34a] px-6 text-[15px] font-semibold text-[#03140a] shadow-[0_12px_30px_-12px_rgba(34,197,94,0.85),inset_0_1px_0_rgba(255,255,255,0.35)] transition duration-200 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong active:scale-[0.985] disabled:cursor-wait disabled:brightness-90"
    />
  );
}

function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 text-sm font-medium text-foreground/90 transition hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:opacity-60"
    />
  );
}

/** Étape 3 : photo de profil (ou logo d'entreprise), envoyée dès qu'elle est choisie. */
function PhotoStep({ isCompany, name, onDone }: { isCompany: boolean; name: string; onDone: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const what = isCompany ? "logo" : "photo";

  // Libère l'aperçu local quand il est remplacé ou à la sortie
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  async function upload(file: File) {
    setError(null);
    if (!ACCEPTED.includes(file.type)) return setError("Format accepté : JPG, PNG, WebP ou GIF.");
    if (file.size > MAX_SIZE) return setError("Le fichier dépasse 5 Mo.");
    setPreview(URL.createObjectURL(file));
    setSaved(false);
    setBusy(true);
    try {
      const form = new FormData();
      form.append("photo", file);
      form.append("space", "user");
      const res = await fetch("/api/avatars", { method: "POST", body: form });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "Envoi impossible.");
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  const leave = () => {
    setLeaving(true);
    onDone();
  };

  return (
    <div>
      <StepTitle
        title={isCompany ? "Ajoutez votre logo" : "Ajoutez une photo de profil"}
        text={
          isCompany
            ? "Votre logo permet à l'équipe de reconnaître votre entreprise d'un coup d'œil."
            : "Une photo rend vos échanges plus humains. Vous pourrez la changer à tout moment."
        }
      />

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void upload(file);
        }}
        disabled={busy}
        aria-label={preview ? `Changer le ${what}` : `Choisir un ${what}`}
        className={`group mx-auto flex w-full flex-col items-center gap-4 rounded-3xl border-2 border-dashed px-6 py-7 transition duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong ${
          dragging ? "border-accent bg-accent/[0.07]" : "border-white/[0.12] bg-white/[0.02] hover:border-accent/50 hover:bg-white/[0.04]"
        }`}
      >
        <span className="relative">
          <span
            aria-hidden
            className={`absolute -inset-2 rounded-full bg-accent/30 blur-xl transition-opacity duration-500 ${saved ? "opacity-100" : "opacity-0"}`}
          />
          <span
            className={`relative grid size-28 place-items-center overflow-hidden bg-[#0d1518] ring-2 transition ${
              isCompany ? "rounded-3xl" : "rounded-full"
            } ${saved ? "ring-accent" : "ring-white/10 group-hover:ring-accent/50"}`}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className={`size-full ${isCompany ? "object-contain p-2" : "object-cover"}`} />
            ) : initials ? (
              <span className="text-3xl font-semibold text-muted/70">{initials}</span>
            ) : (
              <ImagePlus className="size-8 text-muted/70" />
            )}
            {busy && (
              <span className="absolute inset-0 grid place-items-center bg-black/55">
                <Loader2 className="size-7 animate-spin text-white" />
              </span>
            )}
          </span>
          <span className="absolute -right-1 -bottom-1 grid size-9 place-items-center rounded-full border-4 border-[#091013] bg-accent text-[#03140a] transition-transform duration-300 group-hover:scale-110">
            {saved ? <Check className="size-4" strokeWidth={3} /> : <Camera className="size-4" />}
          </span>
        </span>
        <span className="text-center">
          <span className="block text-sm font-semibold">
            {busy
              ? "Envoi en cours…"
              : saved
                ? `${isCompany ? "Logo enregistré" : "Photo enregistrée"} · cliquez pour changer`
                : `Cliquez ou déposez votre ${what} ici`}
          </span>
          <span className="mt-1 block text-xs text-muted">JPG, PNG, WebP ou GIF · 5 Mo maximum</span>
        </span>
      </button>

      {error && (
        <p role="alert" className="mt-3 flex items-center justify-center gap-1.5 text-sm text-rose-300">
          <AlertCircle className="size-4 shrink-0" /> {error}
        </p>
      )}

      <Actions>
        <SecondaryButton type="button" disabled={busy || leaving} onClick={leave}>
          Plus tard
        </SecondaryButton>
        <PrimaryButton type="button" disabled={busy || leaving} onClick={leave}>
          {leaving ? <Loader2 className="size-4 animate-spin" /> : <Briefcase className="size-4" />}
          Accéder à mon espace
        </PrimaryButton>
      </Actions>
    </div>
  );
}
