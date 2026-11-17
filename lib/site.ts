/** Adresse publique du site (SITE_URL dans .env.local), sans « / » final. Utilisée pour le sitemap et le robots.txt. */
export function siteUrl() {
  const raw = process.env.SITE_URL || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
