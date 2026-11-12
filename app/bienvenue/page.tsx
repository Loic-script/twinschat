import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StarfieldBackground } from "@/components/auth/starfield-background";
import { StackedLogo } from "@/components/brand/logo";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getMemberProfile } from "@/lib/profile";

export const metadata: Metadata = { title: "Bienvenue" };

/** Parcours d'accueil après l'inscription : profil, activité, photo ou logo. */
export default async function WelcomePage() {
  const me = await getSessionUser();
  if (!me) redirect("/");
  if (me.role === "admin") redirect("/admin");
  // Profil enregistré il y a peu : on peut encore ajouter la photo (étape 3), même après un rechargement.
  if (me.onboarded) {
    const [row] = await query<{ recent: boolean }>(
      "SELECT onboarded_at > now() - interval '30 minutes' AS recent FROM users WHERE id = $1",
      [me.id],
    );
    if (!row?.recent) redirect("/user");
  }

  const profile = await getMemberProfile(me.id);

  return (
    <main className="relative flex min-h-dvh items-start justify-center overflow-hidden px-4 py-8 sm:items-center short:py-5">
      <StarfieldBackground />
      <div className="relative w-full max-w-xl">
        <h1 className="text-center motion-safe:animate-auth-in">
          <StackedLogo className="mx-auto w-36 drop-shadow-[0_0_24px_rgba(34,197,94,0.22)] short:w-32" gradientId="tc-bubble-welcome" />
        </h1>
        <div className="mt-6 short:mt-4">
          <OnboardingWizard
            initial={{
              name: profile.name,
              phone: profile.phone ?? "",
              company: profile.company ?? "",
              jobTitle: profile.jobTitle ?? "",
              country: profile.country ?? "",
              city: profile.city ?? "",
              website: "",
              languages: profile.languages,
            }}
            email={profile.email}
            startStep={me.onboarded ? 3 : 1}
            isCompanyAccount={profile.role === "entreprise"}
          />
        </div>
      </div>
    </main>
  );
}
