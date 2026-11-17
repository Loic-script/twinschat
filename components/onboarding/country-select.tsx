"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Globe, Search } from "lucide-react";
import { countryOptions, SUGGESTED_COUNTRIES, type Country } from "@/lib/countries";

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("fr");

/** Drapeau du pays (SVG 3:2 dans public/flags, issus de country-flag-icons, licence MIT). */
function Flag({ code }: { code: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/flags/${code}.svg`}
      alt=""
      width={21}
      height={14}
      loading="lazy"
      decoding="async"
      className="h-3.5 w-[21px] shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
    />
  );
}

/**
 * Choix du pays (tous les pays du monde) : liste déroulante avec recherche.
 * Sans recherche, les pays suggérés viennent en tête. Clavier : flèches, Entrée, Échap.
 * La valeur (nom du pays) part avec le formulaire dans le champ caché `name`.
 */
export function CountrySelect({
  id,
  name,
  value,
  error,
  onChange,
  variant = "glass",
}: {
  id: string;
  name: string;
  value: string;
  error?: string;
  onChange: (country: string) => void;
  /** glass : pages d'accueil (fond étoilé) ; field : formulaires de l'espace (profil). */
  variant?: "glass" | "field";
}) {
  const isField = variant === "field";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  // Sens d'ouverture et hauteur de la liste, selon la place autour du bouton (écrans peu hauts)
  const [drop, setDrop] = useState({ up: false, listMax: 256 });
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = `${id}-list`;
  // Comparaison sans accents ni majuscules : un pays saisi à la main avant (« madagascar ») retrouve son drapeau
  const valueKey = normalize(value.trim());
  const selectedCode = useMemo(
    () => (valueKey ? countryOptions().find((c) => normalize(c.name) === valueKey)?.code : undefined),
    [valueKey],
  );

  // Liste : suggestions puis tous les autres pays ; avec une recherche, les pays qui correspondent.
  const { items, splitAt } = useMemo(() => {
    if (!open) return { items: [] as Country[], splitAt: -1 };
    const all = countryOptions();
    const q = normalize(query.trim());
    if (q) return { items: all.filter((c) => normalize(c.name).includes(q)), splitAt: -1 };
    const suggested = SUGGESTED_COUNTRIES.map((code) => all.find((c) => c.code === code)).filter((c): c is Country => !!c);
    const rest = all.filter((c) => !SUGGESTED_COUNTRIES.includes(c.code));
    return { items: [...suggested, ...rest], splitAt: suggested.length };
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // À l'ouverture : curseur dans la recherche, pays choisi visible
  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const i = items.findIndex((c) => c.code === selectedCode);
    setActive(i >= 0 ? i : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // L'option active reste visible quand on navigue au clavier
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const openList = () => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (r) {
      const below = window.innerHeight - r.bottom - 16;
      const above = r.top - 16;
      const up = below < 320 && above > below;
      // 52 px : champ de recherche et marges au-dessus de la liste
      setDrop({ up, listMax: Math.max(140, Math.min(256, (up ? above : below) - 52)) });
    }
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setQuery("");
    buttonRef.current?.focus();
  };
  const choose = (country: Country | undefined) => {
    if (!country) return;
    onChange(country.name);
    close();
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const last = items.length - 1;
    if (e.key === "ArrowDown") setActive((a) => (a >= last ? 0 : a + 1));
    else if (e.key === "ArrowUp") setActive((a) => (a <= 0 ? last : a - 1));
    else if (e.key === "PageDown") setActive((a) => Math.min(last, a + 8));
    else if (e.key === "PageUp") setActive((a) => Math.max(0, a - 8));
    else if (e.key === "Enter") choose(items[active]);
    else if (e.key === "Escape") close();
    else if (e.key === "Tab") return setOpen(false);
    else return;
    e.preventDefault();
  };

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
            e.preventDefault();
            if (!open) openList();
          }
        }}
        className={
          isField
            ? `group flex w-full items-center gap-2.5 rounded-xl border bg-surface-2/50 px-3.5 py-2.5 text-left text-sm transition-colors focus:outline-none ${
                error ? "border-rose-400/70 focus:border-rose-300" : open ? "border-foreground/25" : "border-border focus:border-foreground/25"
              }`
            : `group flex h-12 w-full items-center gap-3 rounded-xl border bg-white/[0.03] px-3.5 text-left transition-[border-color,box-shadow,background-color] duration-200 hover:bg-white/[0.045] focus:outline-none ${
                error
                  ? "border-rose-400/60 focus-visible:shadow-[0_0_0_4px_rgba(251,113,133,0.14)]"
                  : open
                    ? "border-accent/70 bg-white/[0.05] shadow-[0_0_0_4px_rgba(34,197,94,0.15),0_0_24px_-6px_rgba(34,197,94,0.45)]"
                    : "border-white/[0.09] focus-visible:border-accent/70 focus-visible:shadow-[0_0_0_4px_rgba(34,197,94,0.15)]"
              }`
        }
      >
        {selectedCode ? <Flag code={selectedCode} /> : <Globe aria-hidden className="size-4 shrink-0 text-muted/60" />}
        <span
          className={`min-w-0 flex-1 truncate leading-5 ${isField ? "text-sm" : "text-base sm:text-[15px]"} ${
            value ? (isField ? "" : "font-medium") : "text-muted/60"
          }`}
        >
          {value || "Choisissez votre pays"}
        </span>
        <ChevronDown
          aria-hidden
          className={`size-[18px] shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            open ? "rotate-180 text-accent-strong" : "text-muted group-hover:text-foreground"
          }`}
        />
      </button>

      {open && (
        <div
          className={`absolute inset-x-0 z-40 min-w-[16rem] overflow-hidden ${drop.up ? "bottom-full mb-2 origin-bottom" : "top-full mt-2 origin-top"} rounded-2xl border ${
            isField
              ? "border-border bg-surface shadow-[0_24px_60px_-12px_rgba(0,0,0,0.8)]"
              : "border-white/[0.1] bg-[#0b1316] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85),0_0_40px_-18px_rgba(34,197,94,0.55)]"
          } motion-safe:animate-select-in`}
        >
          <div className="relative border-b border-white/[0.07]">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={items[active] ? `${id}-${items[active].code}` : undefined}
              aria-label="Rechercher un pays"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onSearchKeyDown}
              placeholder="Rechercher un pays…"
              autoComplete="off"
              spellCheck={false}
              className="h-11 w-full bg-transparent pr-3 pl-10 text-base placeholder:text-muted/60 focus:outline-none sm:text-sm"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" aria-label="Pays"
            style={{ maxHeight: drop.listMax }}
            className="scroll-thin overflow-y-auto p-1.5"
          >
            {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Aucun pays trouvé.</li>}
            {items.map((country, i) => {
              const isSelected = country.code === selectedCode;
              const isActive = i === active;
              return (
                <li key={country.code} role="presentation">
                  {i === 0 && splitAt > 0 && <GroupLabel>Suggestions</GroupLabel>}
                  {i === splitAt && <GroupLabel separated>Tous les pays</GroupLabel>}
                  <div
                    id={`${id}-${country.code}`}
                    role="option"
                    aria-selected={isSelected}
                    data-index={i}
                    onPointerMove={() => setActive(i)}
                    onClick={() => choose(country)}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-[15px] transition-colors duration-100 ${
                      isActive ? "bg-white/[0.07]" : ""
                    } ${isSelected ? "font-medium text-accent-strong" : "text-foreground/90"}`}
                  >
                    <Flag code={country.code} />
                    <span className="min-w-0 flex-1 truncate">{country.name}</span>
                    {isSelected && <Check className="size-4 shrink-0" strokeWidth={3} aria-hidden />}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function GroupLabel({ children, separated = false }: { children: React.ReactNode; separated?: boolean }) {
  return (
    <p
      aria-hidden
      className={`px-3 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted/70 uppercase ${
        separated ? "mt-1.5 border-t border-white/[0.06] pt-3" : ""
      }`}
    >
      {children}
    </p>
  );
}
