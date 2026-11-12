import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import {
  GOOGLE_COOKIE_PATH,
  GOOGLE_STATE_COOKIE,
  GOOGLE_VERIFIER_COOKIE,
  googleConfig,
  startGoogleAuth,
} from "@/lib/google-auth";

/** Bouton « Continuer avec Google » : départ vers la page de choix de compte Google. */
export async function GET(request: NextRequest) {
  const config = googleConfig(request.nextUrl.origin);
  if (!config) redirect("/?erreur=google-config");

  const { url, state, verifier } = startGoogleAuth(config);
  const store = await cookies();
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const, // envoyés au retour de Google (navigation de premier niveau)
    path: GOOGLE_COOKIE_PATH,
    maxAge: 10 * 60,
  };
  store.set(GOOGLE_STATE_COOKIE, state, options);
  store.set(GOOGLE_VERIFIER_COOKIE, verifier, options);
  redirect(url);
}
