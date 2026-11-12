import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createSession, homeFor } from "@/lib/auth";
import {
  GOOGLE_COOKIE_PATH,
  GOOGLE_STATE_COOKIE,
  GOOGLE_VERIFIER_COOKIE,
  fetchGoogleProfile,
  findOrCreateGoogleUser,
  googleConfig,
} from "@/lib/google-auth";

const sameValue = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Retour de Google : vérifie la demande, ouvre la session, puis envoie chacun dans son espace. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const store = await cookies();
  const expectedState = store.get(GOOGLE_STATE_COOKIE)?.value;
  const verifier = store.get(GOOGLE_VERIFIER_COOKIE)?.value;
  // À usage unique
  store.delete({ name: GOOGLE_STATE_COOKIE, path: GOOGLE_COOKIE_PATH });
  store.delete({ name: GOOGLE_VERIFIER_COOKIE, path: GOOGLE_COOKIE_PATH });

  // L'utilisateur a fermé ou refusé la fenêtre Google
  if (params.get("error")) redirect("/?erreur=google-annule");

  const config = googleConfig(request.nextUrl.origin);
  if (!config) redirect("/?erreur=google-config");

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || !expectedState || !verifier || !sameValue(state, expectedState)) {
    redirect("/?erreur=google");
  }

  let user: Awaited<ReturnType<typeof findOrCreateGoogleUser>>;
  try {
    user = await findOrCreateGoogleUser(await fetchGoogleProfile(config, code, verifier));
  } catch (err) {
    console.error("[connexion Google]", err instanceof Error ? err.message : err);
    redirect("/?erreur=google");
  }

  await createSession(user.id);
  redirect(homeFor(user.role));
}
