/**
 * Icône « Projets » : un P géométrique à double trait (contour extérieur + boucle intérieure
 * parallèle), au format des icônes lucide (24×24, trait en currentColor) pour suivre la palette.
 */
export function ProjectIcon({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      focusable="false"
    >
      {/* Contour extérieur : jambage gauche, grande boucle, retour en second jambage */}
      <path d="M5 21V6.5A2.5 2.5 0 0 1 7.5 4H13a6 6 0 0 1 0 12h-2.5A1.5 1.5 0 0 0 9 17.5V21" />
      {/* Boucle intérieure, ouverte vers le bas à gauche */}
      <path d="M9 11V7.5h4a2.5 2.5 0 0 1 0 5h-1.5" />
    </svg>
  );
}
