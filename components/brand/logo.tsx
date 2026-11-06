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
