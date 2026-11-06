"use client";

import { useEffect, useId, useRef, useState, type PointerEvent } from "react";

export type RegisteredStats = {
  total: number;
  online: number;
  client: number;
  entreprise: number;
  utilisateur: number;
};

const RADIUS = 46; // rayon de l'anneau (repère SVG 100 × 100)
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";
const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** Longue ombre portée à 45° : empilement d'ombres décalées, découpé par la pastille. */
const LONG_SHADOW = (
  [
    [1.5, 0.35],
    [1.5, 0.3],
    [2, 0.24],
    [2.5, 0.18],
    [3, 0.13],
    [3.5, 0.08],
  ] as const
)
  .map(([d, a]) => `drop-shadow(${d}px ${d}px 0 rgba(5,46,22,${a}))`)
  .join(" ");

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

/** Colonne de compteur : la bande 0 → 9 défile verticalement jusqu'au chiffre voulu. */
function RollingDigit({ digit, delay }: { digit: number; delay: number }) {
  return (
    <span className="relative inline-block h-[1em] w-[0.62em] overflow-hidden">
      <span
        className={`absolute inset-x-0 top-0 flex flex-col items-center transition-transform duration-[1200ms] ${EASE} motion-reduce:transition-none`}
        style={{ transform: `translateY(-${digit * 10}%)`, transitionDelay: `${delay}ms` }}
      >
        {DIGITS.map((d) => (
          <span key={d} className="block h-[1em] leading-none">
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * Pastille du nombre d'inscrits :
 * - compteur rotatif (odomètre) et anneau qui se dessine selon la part d'utilisateurs en ligne ;
 * - inclinaison 3D et reflet qui suivent la souris, halo animé, onde et « pop » à chaque changement ;
 * - carte de détails au survol ou au clavier (en ligne, répartition par type).
 * Tout le mouvement est désactivé si l'utilisateur préfère réduire les animations.
 */
export function UserCountBadge({ stats }: { stats: RegisteredStats }) {
  const { total, online } = stats;
  const gradientId = useId();
  const tiltRef = useRef<HTMLSpanElement>(null);
  const reduceMotion = useRef(false);
  const previous = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [popKey, setPopKey] = useState(0);

  // Arrivée : on laisse peindre l'état initial (zéros, anneau vide), puis on lance les animations.
  useEffect(() => {
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion.current) {
      setReady(true);
      return;
    }
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);

  // Le nombre change (inscription, suppression) : « pop » et nouvelle onde.
  useEffect(() => {
    if (previous.current !== null && previous.current !== total) setPopKey((k) => k + 1);
    previous.current = total;
  }, [total]);

  function tilt(e: PointerEvent<HTMLDivElement>) {
    const el = tiltRef.current;
    if (!el || reduceMotion.current || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-y * 24).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(x * 24).toFixed(2)}deg`);
    el.style.setProperty("--gx", `${((x + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty("--gy", `${((y + 0.5) * 100).toFixed(1)}%`);
  }

  function resetTilt() {
    const el = tiltRef.current;
    if (el) ["--rx", "--ry", "--gx", "--gy"].forEach((p) => el.style.removeProperty(p));
  }

  const fraction = total > 0 ? Math.min(1, online / total) : 0;
  const percent = Math.round(fraction * 100);
  const digits = total < 1000 ? String(total).split("").map(Number) : null;
  const compact =
    total >= 1000 ? new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(total) : "";
  const textSize = !digits ? "text-base" : digits.length >= 3 ? "text-[22px]" : "text-[30px]";
  const rows = [
    { label: "Clients", value: stats.client },
    { label: "Entreprises", value: stats.entreprise },
    { label: "Utilisateurs", value: stats.utilisateur },
  ];
  const label =
    `${plural(total, "utilisateur")} inscrit${total > 1 ? "s" : ""}, dont ${online} en ligne : ` +
    `${plural(stats.client, "client")}, ${plural(stats.entreprise, "entreprise")}, ${plural(stats.utilisateur, "utilisateur")}`;

  const drawTransition = `duration-[1400ms] ${EASE} delay-200 motion-reduce:transition-none`;

  return (
    <div
      role="img"
      aria-label={label}
      tabIndex={0}
      onPointerMove={tilt}
      onPointerLeave={resetTilt}
      className="group relative z-30 size-[84px] shrink-0 rounded-full outline-none [perspective:700px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-surface motion-safe:animate-badge-in"
    >
      {/* Halo vert qui tourne lentement */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-1 rounded-full bg-[conic-gradient(from_0deg,rgba(74,222,128,0.9),rgba(34,197,94,0.05),rgba(74,222,128,0.8),rgba(21,128,61,0.15),rgba(74,222,128,0.9))] opacity-50 blur-xl motion-safe:animate-badge-aurora"
      />

      {/* Onde : à l'arrivée puis à chaque changement */}
      <span
        key={`ping-${popKey}`}
        aria-hidden
        className="pointer-events-none absolute inset-[10px] rounded-full bg-accent/40 opacity-0 motion-safe:animate-badge-ping"
      />

      {/* Pastille inclinable (3D) : anneau de progression + disque */}
      <span
        ref={tiltRef}
        aria-hidden
        className="absolute inset-0 block transition-transform duration-300 ease-out [transform-style:preserve-3d]"
        style={{ transform: "rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))" }}
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90 overflow-visible">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#4ade80" />
              <stop offset="1" stopColor="#16a34a" />
            </linearGradient>
          </defs>
          {/* Piste */}
          <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--border)" strokeWidth="3.5" opacity="0.8" />
          {/* Part des utilisateurs en ligne */}
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={ready ? CIRCUMFERENCE * (1 - fraction) : CIRCUMFERENCE}
            className={`transition-[stroke-dashoffset] ${drawTransition}`}
          />
          {/* Point lumineux en tête de l'arc */}
          {fraction > 0 && (
            <g
              className={`transition-transform ${drawTransition}`}
              style={{ transform: `rotate(${ready ? fraction * 360 : 0}deg)`, transformOrigin: "50px 50px" }}
            >
              <circle cx={50 + RADIUS} cy="50" r="3.6" fill="#f8fafc" style={{ filter: "drop-shadow(0 0 3px #4ade80)" }} />
            </g>
          )}
        </svg>

        <span
          key={`pop-${popKey}`}
          className={`absolute inset-[10px] flex items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(135deg,#22c55e_0%,#16a34a_45%,#15803d_100%)] shadow-[0_12px_30px_-10px_rgba(34,197,94,0.7)] ${
            popKey > 0 ? "motion-safe:animate-badge-pop" : ""
          }`}
        >
          {/* Reflet qui suit la souris */}
          <span
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at var(--gx, 30%) var(--gy, 22%), rgba(255,255,255,0.42), transparent 58%)",
            }}
          />
          <span
            className={`relative flex leading-none font-extrabold text-white tabular-nums ${textSize}`}
            style={{ filter: LONG_SHADOW }}
          >
            {digits
              ? digits.map((d, i) => (
                  <RollingDigit
                    key={digits.length - i}
                    digit={ready ? d : 0}
                    delay={(digits.length - 1 - i) * 90}
                  />
                ))
              : compact}
          </span>
        </span>
      </span>

      {/* Carte de détails (survol ou focus clavier) */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-full right-0 z-20 mt-3 w-64 origin-top-right scale-95 rounded-2xl border border-border bg-surface/95 p-4 opacity-0 shadow-2xl shadow-black/50 backdrop-blur transition duration-200 ease-out group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100"
      >
        <p className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums">{total}</span>
          <span className="text-sm text-muted">
            utilisateur{total > 1 ? "s" : ""} inscrit{total > 1 ? "s" : ""}
          </span>
        </p>
        <p className="mt-1 flex items-center gap-2 text-sm">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full rounded-full bg-accent opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-accent" />
          </span>
          <span>{online} en ligne</span>
          <span className="text-muted">· {percent} %</span>
        </p>
        <ul className="mt-4 space-y-2.5">
          {rows.map((row, i) => (
            <li key={row.label}>
              <div className="flex justify-between text-xs">
                <span className="text-muted">{row.label}</span>
                <span className="font-medium tabular-nums">{row.value}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full origin-left scale-x-0 rounded-full bg-gradient-to-r from-accent to-accent-strong transition-transform duration-500 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none"
                  style={{
                    width: `${total > 0 ? Math.round((row.value / total) * 100) : 0}%`,
                    transitionDelay: `${120 + i * 90}ms`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
