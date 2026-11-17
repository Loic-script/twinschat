import type { MetadataRoute } from "next";

/**
 * Manifeste : TwinsChat s'installe comme une application (écran d'accueil du téléphone, ordinateur).
 * Indispensable sur iPhone : les notifications push n'y fonctionnent qu'une fois l'application installée.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "TwinsChat",
    short_name: "TwinsChat",
    description: "Messagerie de l'équipe Twins Dev avec ses clients.",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#05090b",
    theme_color: "#05090b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
