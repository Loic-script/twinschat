import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth/auth-panel";
import { LogoMark } from "@/components/brand/logo";
import { getSessionUser, homeFor } from "@/lib/auth";

export const metadata: Metadata = { title: "Connexion" };

/** Accueil : connexion (admin et utilisateurs) ou inscription. Déjà connecté : direction son espace. */
export default async function Home() {
  const me = await getSessionUser();
  if (me) redirect(homeFor(me.role));

  return (
    <main className="relative flex min-h-dvh items-start justify-center overflow-hidden px-4 py-10 sm:items-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(55%_45%_at_50%_0%,rgba(34,197,94,0.14),transparent_70%)]"
      />
      <div className="relative w-full max-w-md">
        <div className="text-center">
          <LogoMark className="mx-auto w-14" gradientId="tc-bubble-auth" />
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            Twins<span className="text-accent-strong">Chat</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Connectez-vous ou créez votre compte</p>
        </div>

        <div className="mt-6 rounded-[28px] border border-border/60 bg-surface/80 p-5 shadow-2xl shadow-black/40 backdrop-blur sm:p-7">
          <AuthPanel />
        </div>
      </div>
    </main>
  );
}
