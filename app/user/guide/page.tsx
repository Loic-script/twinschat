import type { Metadata } from "next";
import { UserGuide } from "@/components/guide/user-guide";
import { requireMember } from "@/lib/auth";

export const metadata: Metadata = { title: "Guide d'utilisation" };

/**
 * Guide d'utilisation de l'espace utilisateur.
 * `?bienvenue=1` : premier accès, juste après le formulaire d'accueil (bandeau de bienvenue et premiers pas).
 */
export default async function GuidePage({ searchParams }: { searchParams: Promise<{ bienvenue?: string | string[] }> }) {
  const [me, sp] = await Promise.all([requireMember(), searchParams]);
  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <UserGuide welcome={sp.bienvenue === "1"} firstName={me.name.split(" ")[0] ?? ""} />
    </div>
  );
}
