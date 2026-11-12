/**
 * Symbole TwinsChat : le T anguleux hérité de Twins Dev + un C en bulle de discussion.
 * Les mêmes tracés sont utilisés dans public/brand/*.svg et app/icon.svg.
 */
export function LogoMark({
  className = "",
  typing = true,
  gradientId = "tc-bubble",
}: {
  className?: string;
  /** Affiche les trois points « en train d'écrire » (à masquer en très petite taille). */
  typing?: boolean;
  /** Identifiant unique du dégradé si plusieurs logos sont sur la même page. */
  gradientId?: string;
}) {
  return (
    <svg viewBox="0 8 214 140" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="110" y1="32" x2="204" y2="136">
          <stop offset="0" stopColor="var(--accent-strong)" />
          <stop offset="1" stopColor="#16a34a" />
        </linearGradient>
      </defs>
      <path fill="var(--foreground)" d="M10 20H110L118 38H32Z" />
      <path fill="var(--foreground)" d="M50 44L72 52V124L50 116Z" />
      <path
        fill={`url(#${gradientId})`}
        d="M192.77 49.15A48 48 0 1 0 192.77 110.85L177.45 98A28 28 0 1 1 177.45 62Z"
      />
      <path fill={`url(#${gradientId})`} d="M135.7 123.5L110 136L114.43 104Z" />
      {typing && (
        <g fill="var(--accent-strong)">
          <circle cx="144" cy="80" r="4.5" />
          <circle cx="156" cy="80" r="4.5" opacity=".75" />
          <circle cx="168" cy="80" r="4.5" opacity=".5" />
        </g>
      )}
    </svg>
  );
}

/*
 * « TWINS CHAT » dessiné en tracés (hauteur 40, trait de 6) : rendu identique partout,
 * sans dépendre d'une police. Position x de chaque lettre dans le mot-symbole.
 */
const WORDMARK: { x: number; d: string; green?: boolean }[] = [
  { x: 0, d: "M0 3H36M18 3V40" },
  { x: 56, d: "M3 0L13.5 37L25 5L36.5 37L47 0" },
  { x: 126, d: "M3 0V40" },
  { x: 152, d: "M3 40V3L31 37V0" },
  {
    x: 206,
    d: "M25 8C22.5 4.5 18.5 3 14 3C8 3 4 6 4 11C4 16.5 8.5 18.2 14 19.8C20 21.5 25 23.8 25 29.2C25 34.2 20.5 37 14 37C9 37 5 35 3 31.5",
  },
  { x: 282, d: "M33 8A17 17 0 1 0 33 32", green: true },
  { x: 338, d: "M3 0V40M31 0V40M3 20H31", green: true },
  { x: 392, d: "M3 40L20 3L37 40M9 27H31", green: true },
  { x: 452, d: "M0 3H36M18 3V40", green: true },
];

/**
 * Logo empilé : symbole au-dessus de « TWINS CHAT » (public/brand/twinschat-logo-stacked.svg),
 * sans le fond du fichier pour laisser voir l'arrière-plan.
 */
export function StackedLogo({ className = "", gradientId = "tc-bubble-stacked" }: { className?: string; gradientId?: string }) {
  return (
    <svg viewBox="140 84 520 252" className={className} role="img" aria-label="TwinsChat">
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="110" y1="32" x2="204" y2="136">
          <stop offset="0" stopColor="#4ade80" />
          <stop offset="1" stopColor="#16a34a" />
        </linearGradient>
      </defs>
      <svg x="240" y="70" width="321" height="210" viewBox="0 8 214 140">
        <path fill="#f8fafc" d="M10 20H110L118 38H32Z" />
        <path fill="#f8fafc" d="M50 44L72 52V124L50 116Z" />
        <path fill={`url(#${gradientId})`} d="M192.77 49.15A48 48 0 1 0 192.77 110.85L177.45 98A28 28 0 1 1 177.45 62Z" />
        <path fill={`url(#${gradientId})`} d="M135.7 123.5L110 136L114.43 104Z" />
        <g fill="#4ade80">
          <circle cx="144" cy="80" r="4.5" />
          <circle cx="156" cy="80" r="4.5" opacity=".75" />
          <circle cx="168" cy="80" r="4.5" opacity=".5" />
        </g>
      </svg>
      <g transform="translate(156 292)" fill="none" strokeWidth={6} strokeLinejoin="round">
        {WORDMARK.map((letter, i) => (
          <path
            key={i}
            transform={`translate(${letter.x} 0)`}
            stroke={letter.green ? "#4ade80" : "#f8fafc"}
            d={letter.d}
          />
        ))}
      </g>
    </svg>
  );
}

/** Logo horizontal : symbole + « TwinsChat ». */
export function Logo({ className = "", gradientId }: { className?: string; gradientId?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-9 w-auto" gradientId={gradientId} />
      <span className="text-xl font-semibold tracking-tight">
        Twins<span className="text-accent-strong">Chat</span>
      </span>
    </span>
  );
}
