import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { CookieNotice } from "@/components/legal/cookie-notice";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin", "latin-ext"], variable: "--font-outfit", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "TwinsChat", template: "%s · TwinsChat" },
  description: "Messagerie entre utilisateurs, clients et entreprises.",
};

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
