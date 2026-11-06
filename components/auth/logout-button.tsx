"use client";

import { useFormStatus } from "react-dom";
import { Loader2, LogOut } from "lucide-react";
import { logout } from "@/lib/actions/auth";

/**
 * Déconnexion : icône dans le rail latéral (`rail`) ou bouton complet (`button`, pages Profil,
 * utile sur mobile où la barre du bas n'a plus de place).
 */
export function LogoutButton({ variant }: { variant: "rail" | "button" }) {
  return (
    <form action={logout}>
      <LogoutSubmit variant={variant} />
    </form>
  );
}

function LogoutSubmit({ variant }: { variant: "rail" | "button" }) {
  const { pending } = useFormStatus();
  const Icon = pending ? Loader2 : LogOut;
  const iconClass = pending ? "animate-spin" : "";

  if (variant === "rail") {
    return (
      <button
        type="submit"
        disabled={pending}
        title="Se déconnecter"
        aria-label="Se déconnecter"
        className="inline-flex size-11 items-center justify-center rounded-2xl text-muted transition-colors hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-60"
      >
        <Icon className={`size-5 ${iconClass}`} strokeWidth={1.9} />
      </button>
    );
  }
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:border-rose-400/50 hover:bg-rose-500/10 hover:text-rose-200 disabled:opacity-60"
    >
      <Icon className={`size-4 ${iconClass}`} />
      Se déconnecter
    </button>
  );
}
