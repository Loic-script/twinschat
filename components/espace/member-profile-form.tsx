"use client";

import { Fragment, useActionState, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { updateMemberProfile, type MemberField, type MemberProfileState } from "@/app/user/profil/actions";
import type { MemberProfile } from "@/lib/profile";
import { LanguagePicker } from "./language-picker";

const initialState: MemberProfileState = { status: "idle" };

type FieldDef = {
  name: MemberField;
  label: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  max: number;
  wide?: boolean;
  multiline?: boolean;
  /** Suggestions (datalist). */
  list?: string;
};

/** Suggestions de pays (saisie libre possible). */
const COUNTRIES = [
  "Madagascar",
  "France",
  "Maurice",
  "La Réunion",
  "Comores",
  "Mayotte",
  "Seychelles",
  "Belgique",
  "Suisse",
  "Canada",
  "États-Unis",
  "Royaume-Uni",
  "Allemagne",
  "Espagne",
  "Italie",
  "Afrique du Sud",
  "Sénégal",
  "Côte d'Ivoire",
  "Chine",
  "Japon",
];

/** Champs regroupés par rubrique ; la société est obligatoire pour une entreprise. */
function groups(isCompany: boolean): { title: string; fields: FieldDef[] }[] {
  return [
    {
      title: "Identité",
      fields: [
        { name: "name", label: isCompany ? "Personne de contact" : "Nom et prénom", autoComplete: "name", max: 80 },
        { name: "email", label: "E-mail", type: "email", autoComplete: "email", max: 254 },
        { name: "phone", label: "Téléphone", type: "tel", autoComplete: "tel", placeholder: "+261 34 00 000 00", max: 30 },
      ],
    },
    {
      title: "Activité",
      fields: [
        {
          name: "company",
          label: isCompany ? "Nom de l'entreprise" : "Entreprise ou organisation",
          autoComplete: "organization",
          max: 80,
        },
        { name: "jobTitle", label: "Poste", autoComplete: "organization-title", placeholder: "Ex. Responsable marketing", max: 80 },
        { name: "workplace", label: "Lieu de travail", placeholder: "Ex. Siège, télétravail…", max: 120 },
      ],
    },
    {
      title: "Adresse",
      fields: [
        { name: "country", label: "Pays", autoComplete: "country-name", placeholder: "Ex. Madagascar", max: 80, list: "member-countries" },
        { name: "city", label: "Ville", autoComplete: "address-level2", placeholder: "Ex. Antananarivo", max: 80 },
        { name: "address", label: "Adresse", autoComplete: "street-address", max: 200, wide: true },
      ],
    },
    {
      title: "Présentation",
      fields: [
        {
          name: "description",
          label: "À propos",
          placeholder: "Quelques mots sur vous ou votre activité…",
          max: 1000,
          wide: true,
          multiline: true,
        },
      ],
    },
  ];
}

const savedValue = (p: MemberProfile, f: MemberField) => {
  const map: Record<MemberField, string | null> = {
    name: p.name,
    email: p.email,
    phone: p.phone,
    company: p.company,
    jobTitle: p.jobTitle,
    workplace: p.workplace,
    city: p.city,
    country: p.country,
    address: p.address,
    description: p.description,
  };
  return map[f] ?? "";
};

/** Informations du profil (nom, contact, activité, adresse, présentation). */
export function MemberProfileForm({ profile }: { profile: MemberProfile }) {
  const [state, formAction, pending] = useActionState(updateMemberProfile, initialState);
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

  const isCompany = profile.role === "entreprise";

  return (
    <form
      key={formKey}
      action={formAction}
      onChange={() => {
        setDirty(true);
        setShowSaved(false);
      }}
      noValidate
      className="space-y-7"
    >
      <datalist id="member-countries">
        {COUNTRIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {groups(isCompany).map((group) => (
        <Fragment key={group.title}>
        {/* Les langues se placent juste avant la présentation */}
        {group.title === "Présentation" && (
          <fieldset>
            <legend className="mb-1 text-xs font-medium tracking-wide text-muted uppercase">Langues</legend>
            <p className="mb-3 text-sm text-muted">Les langues que vous parlez (plusieurs choix possibles).</p>
            <LanguagePicker
              defaultValue={!discarded && state.languages ? state.languages : profile.languages}
              onChange={() => {
                setDirty(true);
                setShowSaved(false);
              }}
            />
          </fieldset>
        )}
        <fieldset>
          <legend className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">{group.title}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {group.fields.map((f) => {
              const error = state.status === "error" ? state.errors?.[f.name] : undefined;
              const id = `member-${f.name}`;
              const defaultValue = !discarded && state.values ? state.values[f.name] : savedValue(profile, f.name);
              const common = {
                id,
                name: f.name,
                maxLength: f.max,
                placeholder: f.placeholder,
                defaultValue,
                "aria-invalid": !!error,
                "aria-describedby": error ? `${id}-error` : undefined,
                className: `w-full rounded-xl border bg-surface-2/50 px-3.5 py-2.5 text-sm placeholder:text-muted/60 focus:outline-none ${
                  error ? "border-rose-400/70 focus:border-rose-300" : "border-border focus:border-foreground/25"
                }`,
              };
              return (
                <div key={f.name} className={f.wide ? "sm:col-span-2" : undefined}>
                  <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground/90">
                    {f.label}
                  </label>
                  {f.multiline ? (
                    <textarea {...common} rows={4} className={`${common.className} resize-y`} />
                  ) : (
                    <input {...common} type={f.type ?? "text"} autoComplete={f.autoComplete} list={f.list} />
                  )}
                  {error && (
                    <p id={`${id}-error`} className="mt-1.5 text-xs text-rose-300">
                      {error}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
        </Fragment>
      ))}

      <div className="flex flex-wrap items-center justify-end gap-3">
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
