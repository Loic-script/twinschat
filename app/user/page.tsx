import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";

/** Arrivée dans l'espace utilisateur : le guide d'abord tant qu'il n'a jamais été vu, sinon les messages. */
export default async function MemberHome() {
  const me = await requireMember();
  redirect(me.guideSeen ? "/user/messages" : "/user/guide?bienvenue=1");
}
