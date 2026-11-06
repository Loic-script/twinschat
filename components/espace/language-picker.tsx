"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { ALL_LANGUAGE_CODES, languageName, MAIN_LANGUAGES } from "@/lib/languages";

const MAIN = new Set<string>(MAIN_LANGUAGES);
const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("fr");

const chip = (on: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
    on
      ? "border-accent/50 bg-accent/10 text-foreground"
      : "border-border bg-surface-2/50 text-muted hover:border-foreground/25 hover:text-foreground"
  }`;

/**
 * Langues parlées (choix multiple) : les langues courantes en un clic, et « Autre… »
 * pour chercher parmi toutes les langues. Envoyées au formulaire (champs `languages`).
 */
export function LanguagePicker({ defaultValue, onChange }: { defaultValue: string[]; onChange?: () => void }) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const [otherOpen, setOtherOpen] = useState(false);
  const [search, setSearch] = useState("");

  function toggle(code: string) {
    setSelected((list) => (list.includes(code) ? list.filter((c) => c !== code) : [...list, code]));
    onChange?.();
  }

  const others = selected.filter((c) => !MAIN.has(c));
  const choices = useMemo(() => {
    if (!otherOpen) return [];
    const q = normalize(search.trim());
    return ALL_LANGUAGE_CODES.filter((c) => !MAIN.has(c))
      .map((code) => ({ code, name: languageName(code) }))
      .filter((l) => !q || normalize(l.name).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [otherOpen, search]);

  return (
    <div>
      {selected.map((code) => (
        <input key={code} type="hidden" name="languages" value={code} />
      ))}

      <div role="group" aria-label="Langues parlées" className="flex flex-wrap gap-2">
        {MAIN_LANGUAGES.map((code) => {
          const on = selected.includes(code);
          return (
            <button key={code} type="button" onClick={() => toggle(code)} aria-pressed={on} className={chip(on)}>
              {on && <Check className="size-3.5 text-accent-strong" />}
              {languageName(code)}
            </button>
          );
        })}
        {others.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => toggle(code)}
            aria-label={`Retirer ${languageName(code)}`}
            title="Retirer"
            className={chip(true)}
          >
            <span suppressHydrationWarning>{languageName(code)}</span>
            <X className="size-3.5 text-muted" />
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOtherOpen((v) => !v)}
          aria-expanded={otherOpen}
          aria-controls="language-others"
          className={`${chip(false)} border-dashed`}
        >
          <Plus className="size-3.5" /> Autre…
        </button>
      </div>

      {otherOpen && (
        <div id="language-others" className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface-2/40">
          <label className="relative block border-b border-border/60">
            <span className="sr-only">Rechercher une langue</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
                if (e.key === "Escape") setOtherOpen(false);
              }}
              placeholder="Rechercher une langue (ex. allemand, arabe, chinois…)"
              className="w-full bg-transparent py-3 pr-4 pl-10 text-sm placeholder:text-muted/70 focus:outline-none"
            />
          </label>
          <ul className="scroll-thin max-h-56 overflow-y-auto p-1.5">
            {choices.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted">Aucune langue trouvée.</li>}
            {choices.map(({ code, name }) => {
              const on = selected.includes(code);
              return (
                <li key={code}>
                  <button
                    type="button"
                    onClick={() => toggle(code)}
                    aria-pressed={on}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-surface-2"
                  >
                    <span
                      className={`inline-flex size-4 shrink-0 items-center justify-center rounded border ${
                        on ? "border-accent bg-accent text-background" : "border-border"
                      }`}
                    >
                      {on && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    {name}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
