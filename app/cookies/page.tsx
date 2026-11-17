import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Cookies",
  description: "Les cookies et données enregistrées par TwinsChat sur votre appareil.",
};

const COOKIES = [
  {
    name: "tc_session",
    purpose: "Garde votre session ouverte après la connexion.",
    duration: "30 jours (supprimé à la déconnexion)",
  },
  {
    name: "tc_google_state, tc_google_verifier",
    purpose: "Sécurisent la connexion avec Google (protection contre la falsification de la demande).",
    duration: "10 minutes",
  },
];

const STORAGE = [
  { name: "twinschat:cookies-ok", purpose: "Retient que vous avez lu le bandeau d'information sur les cookies." },
  { name: "twinschat:traduction:…", purpose: "Langue de traduction choisie dans les discussions." },
  { name: "twinschat:rubriques-vues:…", purpose: "Dernier passage dans chaque rubrique (point vert des nouveautés)." },
];

/** Page publique : cookies et stockage local utilisés par TwinsChat. */
export default function CookiesPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-10 md:py-16">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Retour
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Cookies</h1>
      <p className="mt-3 leading-relaxed text-muted">
        TwinsChat n&apos;utilise que des cookies <strong className="text-foreground">strictement nécessaires</strong> au
        fonctionnement du service. Il n&apos;y a ni cookie publicitaire, ni mesure d&apos;audience, ni partage avec des
        tiers : aucun consentement n&apos;est donc requis, et vous n&apos;avez rien à paramétrer.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Cookies</h2>
      <Table head={["Nom", "Rôle", "Durée"]} rows={COOKIES.map((c) => [c.name, c.purpose, c.duration])} />

      <h2 className="mt-10 text-xl font-semibold">Stockage sur votre appareil</h2>
      <p className="mt-2 text-sm text-muted">
        Quelques préférences d&apos;affichage sont gardées dans le stockage local du navigateur. Elles ne quittent pas votre
        appareil et vous pouvez les effacer depuis les réglages du navigateur.
      </p>
      <Table head={["Clé", "Rôle"]} rows={STORAGE.map((s) => [s.name, s.purpose])} />

      <p className="mt-10 text-sm text-muted">
        Pour supprimer ces cookies, déconnectez-vous ou effacez les données du site dans votre navigateur.
      </p>
    </main>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-border/60">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="bg-surface-2/50 text-xs tracking-wide text-muted uppercase">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map((r) => (
            <tr key={r[0]}>
              {r.map((cell, i) => (
                <td key={i} className={`px-4 py-3 align-top ${i === 0 ? "font-mono text-xs text-foreground/90" : "text-muted"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
