import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * Plan du site : uniquement les pages publiques. Les espaces admin et utilisateur sont privés
 * (connexion obligatoire) et ne doivent pas être indexés.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/cookies`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
