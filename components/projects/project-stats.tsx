"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Banknote, CircleCheckBig, Hourglass, Lightbulb, TrendingUp, type LucideIcon } from "lucide-react";
import { ProjectIcon } from "@/components/brand/project-icon";

export type ProjectStatsData = {
  total: number;
  propose: number;
  en_cours: number;
  termine: number;
  paye: number;
  /** Projets proposés depuis le début du mois. */
  thisMonth: number;
};

export type StatFilter = "propose" | "en_cours" | "termine" | "paye";

const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";

/** Couleurs sobres, les mêmes que les pastilles de statut. */
const CARDS: { key: StatFilter; label: string; icon: LucideIcon; bar: string; stroke: string }[] = [
  { key: "propose", label: "Proposés", icon: Lightbulb, bar: "bg-muted", stroke: "#94a3b8" },
  { key: "en_cours", label: "En cours", icon: Hourglass, bar: "bg-amber-400", stroke: "#fbbf24" },
  { key: "termine", label: "Terminés", icon: CircleCheckBig, bar: "bg-accent", stroke: "#22c55e" },
  { key: "paye", label: "Payés", icon: Banknote, bar: "bg-accent-strong", stroke: "#4ade80" },
];

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

/** Préfère-t-on réduire les animations ? (lu une fois, côté client) */
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  return reduced;
}

/** Compteur animé : défile jusqu'à la valeur (et d'une valeur à l'autre quand elle change). */
function CountUp({ value, reduced }: { value: number; reduced: boolean }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);

  useEffect(() => {
    if (reduced) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const origin = from.current;
    const duration = 900;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(origin + (value - origin) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);

  return <span className="tabular-nums">{shown}</span>;
}

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Anneau de répartition des statuts (proposés, en cours, terminés). */
function StatusRing({ stats, ready }: { stats: ProjectStatsData; ready: boolean }) {
  const segments = CARDS.filter((c) => c.key !== "paye").map((c) => ({ ...c, value: stats[c.key] }));
  const gap = stats.total > 0 && segments.filter((s) => s.value > 0).length > 1 ? 6 : 0;
  let offset = 0;
  const done = pct(stats.termine, stats.total);

  return (
    <div className="relative size-[148px] shrink-0">
      <svg viewBox="0 0 128 128" className="size-full -rotate-90" aria-hidden>
        <circle cx="64" cy="64" r={RADIUS} fill="none" stroke="var(--border)" strokeWidth="10" opacity="0.7" />
        {stats.total > 0 &&
          segments.map((s) => {
            const length = (s.value / stats.total) * CIRCUMFERENCE;
            const visible = Math.max(0, length - gap);
            const dash = ready ? visible : 0;
            const circle = (
              <circle
                key={s.key}
                cx="64"
                cy="64"
                r={RADIUS}
                fill="none"
                stroke={s.stroke}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
                strokeDashoffset={-offset}
                className={`transition-[stroke-dasharray] duration-[1200ms] ${EASE} motion-reduce:transition-none`}
              />
            );
            offset += length;
            return s.value > 0 ? circle : null;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl leading-none font-semibold tabular-nums">{done}%</span>
        <span className="mt-1 text-[11px] text-muted">terminés</span>
      </div>
    </div>
  );
}

/**
 * Chiffres clés des projets : total avec répartition des statuts, puis une carte par statut
 * (et les projets payés). Chaque carte filtre la liste en dessous (`?statut=`).
 */
export function ProjectStats({
  stats,
  active,
  basePath,
  query = "",
  totalLabel = "Projets",
}: {
  stats: ProjectStatsData;
  active: StatFilter | null;
  /** Page de la liste filtrée (ex. /admin/statistiques). */
  basePath: string;
  /** Autres paramètres à garder dans l'adresse (ex. « q=boutique »). */
  query?: string;
  totalLabel?: string;
}) {
  const reduced = useReducedMotion();
  const [ready, setReady] = useState(false);

  // On laisse peindre l'état initial (anneau et barres vides), puis on lance les animations.
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  const href = (filter: StatFilter | null) => {
    const params = new URLSearchParams(query);
    if (filter) params.set("statut", filter);
    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };
  const appear = (i: number): CSSProperties => ({ animationDelay: `${i * 70}ms` });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Total et répartition */}
      <Link
        href={href(null)}
        scroll={false}
        aria-current={active === null ? "true" : undefined}
        style={appear(0)}
        className={`group relative flex flex-col justify-between gap-6 overflow-hidden rounded-[26px] border bg-surface-2/35 p-6 transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 motion-safe:animate-stat-in sm:flex-row sm:items-center ${
          active === null ? "border-accent/45" : "border-border/60 hover:border-border"
        }`}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-accent/10 opacity-70 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(circle,rgba(148,163,184,.35)_1px,transparent_1.5px)] [background-size:20px_20px] [mask-image:linear-gradient(to_bottom_left,black,transparent_60%)]"
        />

        <div className="relative min-w-0">
          <span className="inline-flex items-center gap-2 text-xs font-medium tracking-wide text-muted uppercase">
            <ProjectIcon className="size-4" /> {totalLabel}
          </span>
          <p className="mt-3 text-[56px] leading-none font-semibold tracking-tight">
            <CountUp value={stats.total} reduced={reduced} />
          </p>
          <p
            className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              stats.thisMonth > 0 ? "bg-accent/10 text-accent-strong" : "bg-surface-2/70 text-muted"
            }`}
          >
            <TrendingUp className="size-3.5" />
            {stats.thisMonth > 0 ? `+${stats.thisMonth} ce mois-ci` : "Aucun nouveau projet ce mois-ci"}
          </p>
          <ul className="mt-5 space-y-1.5 text-sm">
            {CARDS.filter((c) => c.key !== "paye").map((c) => (
              <li key={c.key} className="flex items-center gap-2.5">
                <span aria-hidden className={`size-2 rounded-full ${c.bar}`} />
                <span className="text-muted">{c.label}</span>
                <span className="ml-auto pl-6 font-medium tabular-nums">{stats[c.key]}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative self-center">
          <StatusRing stats={stats} ready={ready} />
        </div>
      </Link>

      {/* Une carte par statut */}
      <ul className="grid grid-cols-2 gap-4">
        {CARDS.map(({ key, label, icon: Icon, bar }, i) => {
          const value = stats[key];
          const share = pct(value, stats.total);
          const isActive = active === key;
          return (
            <li key={key} style={appear(i + 1)} className="motion-safe:animate-stat-in">
              <Link
                href={isActive ? href(null) : href(key)}
                scroll={false}
                aria-current={isActive ? "true" : undefined}
                aria-label={`${label} : ${value} projet${value > 1 ? "s" : ""}, ${share} % du total${
                  isActive ? " (filtre actif, cliquer pour l'enlever)" : ""
                }`}
                className={`group relative flex h-full flex-col justify-between gap-4 overflow-hidden rounded-[22px] border p-5 transition-[border-color,background-color,transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 ${
                  isActive
                    ? "border-accent/45 bg-accent/[0.06]"
                    : "border-border/60 bg-surface-2/35 hover:border-border hover:bg-surface-2/55"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`inline-flex size-10 shrink-0 items-center justify-center rounded-2xl transition-colors ${
                      isActive ? "bg-accent text-background" : "bg-surface-2/80 text-muted group-hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-[18px]" strokeWidth={1.9} />
                  </span>
                  <span className="text-sm font-medium text-foreground/85">{label}</span>
                </span>

                <span>
                  <span className="flex items-baseline gap-2">
                    <span className="text-[34px] leading-none font-semibold tracking-tight">
                      <CountUp value={value} reduced={reduced} />
                    </span>
                    <span className="text-xs text-muted tabular-nums">{share} %</span>
                  </span>
                  <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <span
                      className={`block h-full origin-left rounded-full ${bar} transition-transform duration-[1100ms] ${EASE} motion-reduce:transition-none`}
                      style={{ transform: `scaleX(${ready ? share / 100 : 0})`, transitionDelay: `${150 + i * 90}ms` }}
                    />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
