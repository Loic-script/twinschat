import type { Metadata } from "next";
import { Mail, ShieldCheck } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { AvatarEditor } from "@/components/profile/avatar-editor";
import { CoverEditor } from "@/components/profile/cover-editor";
import { PasswordForm } from "@/components/profile/password-form";
import { ProfileForm } from "@/components/profile/profile-form";
import { requireAdmin } from "@/lib/auth";
import { getAdminProfile } from "@/lib/profile";

export const metadata: Metadata = { title: "Profil admin" };

/** Profil admin : photo de couverture, photo de profil, pseudo, e-mail et mot de passe. */
export default async function AdminProfilePage() {
  const admin = await requireAdmin();
  const profile = await getAdminProfile(admin.id);

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">
        <h1 className="sr-only">Profil admin</h1>

        {/* Couverture, photo et identité */}
        <section className="overflow-hidden rounded-[28px] border border-border/60 bg-surface-2/35">
          <CoverEditor coverUrl={profile.coverUrl} space="admin" />
          <div className="flex flex-col gap-6 px-6 pb-6 md:flex-row md:px-8">
            <div className="-mt-14 md:-mt-16">
              <AvatarEditor name={profile.name} avatarUrl={profile.avatarUrl} space="admin" />
            </div>
            <div className="min-w-0 flex-1 md:pt-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{profile.name}</h2>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2/40 px-2.5 py-0.5 text-[11px] font-medium text-foreground/75">
                  <ShieldCheck className="size-3" /> Administrateur
                </span>
              </div>
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted">
                <Mail className="size-4" /> {profile.email}
              </p>
            </div>
          </div>
        </section>

        {/* Pseudo et e-mail */}
        <section className="mt-6 rounded-[24px] border border-border/60 bg-surface-2/35 p-6">
          <h2 className="text-lg font-semibold">Pseudo et e-mail</h2>
          <p className="mt-1 mb-6 text-sm text-muted">Votre pseudo est visible par les utilisateurs dans les discussions.</p>
          <ProfileForm profile={profile} />
        </section>

        {/* Mot de passe */}
        <section className="mt-6 rounded-[24px] border border-border/60 bg-surface-2/35 p-6">
          <h2 className="text-lg font-semibold">Mot de passe</h2>
          <p className="mt-1 mb-6 text-sm text-muted">
            {profile.hasPassword
              ? "Saisissez votre mot de passe actuel, puis le nouveau."
              : "Aucun mot de passe n'est encore défini pour ce compte."}
          </p>
          <PasswordForm hasPassword={profile.hasPassword} space="admin" />
        </section>

        {/* Session */}
        <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-border/60 bg-surface-2/35 p-6">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Session</h2>
            <p className="mt-1 truncate text-sm text-muted">Connecté avec {admin.email}</p>
          </div>
          <LogoutButton variant="button" />
        </section>
      </div>
    </div>
  );
}
