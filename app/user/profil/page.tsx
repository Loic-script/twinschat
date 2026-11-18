import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CalendarDays, Mail } from "lucide-react";
import { ProjectIcon } from "@/components/brand/project-icon";
import { MemberProfileForm } from "@/components/espace/member-profile-form";
import { LogoutButton } from "@/components/auth/logout-button";
import { AvatarEditor } from "@/components/profile/avatar-editor";
import { CoverEditor } from "@/components/profile/cover-editor";
import { PasswordForm } from "@/components/profile/password-form";
import { TranslationSettings } from "@/components/profile/translation-settings";
import { PushSwitch } from "@/components/layout/push-client";
import { requireMember } from "@/lib/auth";
import { displayName, formatDate, ROLE_LABELS } from "@/lib/format";
import { getMemberProfile } from "@/lib/profile";
import { getTranslationSettings } from "@/lib/translate";

export const metadata: Metadata = { title: "Mon profil" };

/** Profil de l'utilisateur : photos, informations et mot de passe. */
export default async function MemberProfilePage() {
  const me = await requireMember();
  const [profile, translation] = await Promise.all([getMemberProfile(me.id), getTranslationSettings(me.id)]);
  const title = displayName(profile);

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">
        <h1 className="sr-only">Mon profil</h1>

        {/* Couverture, photo et identité */}
        <section className="overflow-hidden rounded-[28px] border border-border/60 bg-surface-2/35">
          <CoverEditor coverUrl={profile.coverUrl} space="user" />
          <div className="flex flex-col gap-6 px-6 pb-6 md:flex-row md:px-8">
            <div className="-mt-14 md:-mt-16">
              <AvatarEditor name={profile.name} avatarUrl={profile.avatarUrl} space="user" />
            </div>
            <div className="min-w-0 flex-1 md:pt-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
                <span className="inline-flex items-center rounded-full border border-border bg-surface-2/40 px-2.5 py-0.5 text-[11px] font-medium text-foreground/75">
                  {ROLE_LABELS[profile.role]}
                </span>
              </div>
              {title !== profile.name && <p className="mt-1 text-sm text-foreground/80">{profile.name}</p>}
              <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted">
                <li className="inline-flex items-center gap-1.5">
                  <Mail className="size-4" /> {profile.email}
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4" /> Membre depuis le {formatDate(profile.createdAt)}
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <ProjectIcon className="size-4" /> {profile.projectsCount} projet{profile.projectsCount > 1 ? "s" : ""}
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Guide d'utilisation (accès principal sur mobile) */}
        <Link
          href="/user/guide"
          className="group mt-6 flex items-center gap-4 rounded-[24px] border border-accent/30 bg-accent/[0.07] p-5 transition hover:border-accent/50 hover:bg-accent/[0.1]"
        >
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent-strong">
            <BookOpen className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold group-hover:text-accent-strong">Guide d&apos;utilisation</span>
            <span className="block text-sm text-muted">Messages, projets, ressources, notifications : tout est expliqué pas à pas.</span>
          </span>
          <span aria-hidden className="text-lg text-muted group-hover:text-accent-strong">
            →
          </span>
        </Link>

        {/* Informations */}
        <section className="mt-6 rounded-[24px] border border-border/60 bg-surface-2/35 p-6">
          <h2 className="text-lg font-semibold">Mes informations</h2>
          <p className="mt-1 mb-6 text-sm text-muted">
            Ces informations aident l&apos;équipe Twins Dev à vous connaître et à suivre vos projets.
          </p>
          <MemberProfileForm profile={profile} />
        </section>

        {/* Traduction des messages */}
        <section className="mt-6 rounded-[24px] border border-border/60 bg-surface-2/35 p-6">
          <h2 className="mb-5 text-lg font-semibold">Traduction</h2>
          <TranslationSettings space="user" enabled={translation.enabled} languages={translation.languages} server={translation.server} />
        </section>

        {/* Notifications push de cet appareil */}
        <section className="mt-6 rounded-[24px] border border-border/60 bg-surface-2/35 p-6">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <p className="mt-1 text-sm text-muted">
            Recevez les nouveaux messages sur ce téléphone ou cet ordinateur, même quand TwinsChat est fermé.
            À activer sur chaque appareil.
          </p>
          <ul className="mt-3">
            <PushSwitch space="user" />
          </ul>
        </section>

        {/* Mot de passe */}
        <section className="mt-6 rounded-[24px] border border-border/60 bg-surface-2/35 p-6">
          <h2 className="text-lg font-semibold">Mot de passe</h2>
          <p className="mt-1 mb-6 text-sm text-muted">
            {profile.hasPassword
              ? "Saisissez votre mot de passe actuel, puis le nouveau."
              : "Aucun mot de passe n'est encore défini pour ce compte."}
          </p>
          <PasswordForm hasPassword={profile.hasPassword} space="user" />
        </section>

        {/* Session */}
        <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-border/60 bg-surface-2/35 p-6">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Session</h2>
            <p className="mt-1 truncate text-sm text-muted">Connecté avec {me.email}</p>
          </div>
          <LogoutButton variant="button" />
        </section>
      </div>
    </div>
  );
}
