import { initials } from "@/lib/format";
import type { Status } from "@/lib/types";

// Même style pour tous les avatars (celui du profil admin dans le menu) : dégradé vert sombre, initiales blanches.
const AVATAR_STYLE = "bg-gradient-to-br from-accent-strong/30 to-surface-2 text-foreground";

const SIZES = {
  xs: { box: "size-6 text-[10px]", dot: "size-2 border" },
  sm: { box: "size-8 text-xs", dot: "size-3 border-2" },
  md: { box: "size-10 text-sm", dot: "size-3 border-2" },
  lg: { box: "size-11 text-sm", dot: "size-3 border-2" },
  xl: { box: "size-12 text-base", dot: "size-3.5 border-2" },
  "2xl": { box: "size-20 text-2xl", dot: "size-4 border-[3px] right-0.5 bottom-0.5" },
  "3xl": { box: "size-28 text-4xl", dot: "size-5 border-4 right-1 bottom-1" },
};

export function Avatar({
  name,
  size = "md",
  status,
  src,
  className = "",
}: {
  name: string;
  size?: keyof typeof SIZES;
  status?: Status;
  /** Photo de profil ; sans photo, les initiales sont affichées. */
  src?: string | null;
  className?: string;
}) {
  const { box, dot } = SIZES[size];
  return (
    <span className={`relative inline-flex shrink-0 rounded-full ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- photo privée servie par l'API
        <img src={src} alt="" aria-hidden className={`${box} rounded-full object-cover`} />
      ) : (
        <span
          aria-hidden
          className={`${box} ${AVATAR_STYLE} inline-flex items-center justify-center rounded-full font-semibold`}
        >
          {initials(name)}
        </span>
      )}
      {/* Point vert uniquement pour les personnes en ligne */}
      {status === "en_ligne" && (
        <span
          aria-label="En ligne"
          className={`absolute -right-0.5 -bottom-0.5 rounded-full border-surface bg-accent ${dot}`}
        />
      )}
    </span>
  );
}
