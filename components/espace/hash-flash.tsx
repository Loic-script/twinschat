"use client";

import { useEffect } from "react";

/** Fait défiler jusqu'à l'élément et le met brièvement en évidence (animation `.flash`). */
export function flashElement(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("flash");
  void el.offsetWidth; // relance l'animation
  el.classList.add("flash");
}

/**
 * Met en évidence l'élément visé par l'ancre de l'adresse (ex. `#projet-…` depuis une
 * notification). Le routeur de Next utilise pushState : `:target` ne suffit pas.
 */
export function HashFlash() {
  useEffect(() => {
    const run = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (id) flashElement(id);
    };
    run();
    window.addEventListener("hashchange", run);
    return () => window.removeEventListener("hashchange", run);
  }, []);
  return null;
}
