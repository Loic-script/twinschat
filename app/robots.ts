import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/** Moteurs de recherche : page de connexion et page cookies seulement ; espaces privés et API exclus. */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/cookies"],
      disallow: ["/admin", "/user", "/bienvenue", "/api/"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
