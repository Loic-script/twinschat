import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { CookieNotice } from "@/components/legal/cookie-notice";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin", "latin-ext"], variable: "--font-outfit", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "TwinsChat", template: "%s · TwinsChat" },
  description: "Messagerie entre utilisateurs, clients et entreprises.",
  // Application installable (écran d'accueil) : indispensable aux notifications push sur iPhone
  applicationName: "TwinsChat",
  appleWebApp: { capable: true, title: "TwinsChat", statusBarStyle: "black-translucent" },
  // Logo dans l'onglet du navigateur : SVG (net à toutes les tailles) + PNG pour les navigateurs sans favicon SVG
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = { themeColor: "#05090b" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={outfit.variable}>
      <body>
        {children}
        <CookieNotice />
      </body>
    </html>
  );
}
