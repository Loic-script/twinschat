import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth/auth-panel";
import { StarfieldBackground } from "@/components/auth/starfield-background";
import { StackedLogo } from "@/components/brand/logo";
import { getSessionUser, homeFor } from "@/lib/auth";

export const metadata: Metadata = { title: "Connexion" };

/** Accueil : connexion (admin et utilisateurs) ou inscription. Déjà connecté : direction son espace. */
/** Messages affichés au retour de la connexion Google (/?erreur=…). */
const GOOGLE_NOTICES: Record<string, string> = {
  google: "La connexion avec Google a échoué. Réessayez.",
  "google-annule": "Connexion avec Google annulée.",
  "google-config": "La connexion avec Google n'est pas encore configurée.",
};

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await getSessionUser();
  if (me) redirect(homeFor(me.role));
  const { erreur } = await searchParams;
  const notice = typeof erreur === "string" ? GOOGLE_NOTICES[erreur] : undefined;

  return (
    <main className="relative flex min-h-dvh items-start justify-center overflow-hidden px-4 py-10 sm:items-center short:py-5">
      <StarfieldBackground />
      <div className="relative w-full max-w-md">
        <h1 className="text-center motion-safe:animate-auth-in">
          <StackedLogo
            className="mx-auto w-48 drop-shadow-[0_0_24px_rgba(34,197,94,0.22)] sm:w-56 short:w-44"
            gradientId="tc-bubble-auth"
          />
        </h1>

        <div className="mt-7 short:mt-5">
          <AuthPanel notice={notice} />
        </div>
      </div>
    </main>
  );
}
