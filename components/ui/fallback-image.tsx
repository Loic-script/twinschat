"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Image (photo de profil, couverture) remplacée par `fallback` si elle ne se charge pas :
 * fichier introuvable sur le serveur, session expirée… au lieu de l'icône « image cassée ».
 */
export function FallbackImage({
  src,
  className,
  fallback = null,
}: {
  src: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);

  // Nouvelle adresse : on retente le chargement
  useEffect(() => setFailed(false), [src]);

  // Erreur survenue avant l'hydratation (onError non encore branché)
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);

  if (failed) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element -- photo privée servie par l'API
  return <img ref={ref} src={src} alt="" aria-hidden className={className} onError={() => setFailed(true)} />;
}
