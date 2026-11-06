import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarDays,
  Clock3,
  Globe,
  Languages,
  Mail,
  MapPin,
  MessageSquareText,
} from "lucide-react";
import { startConversation } from "@/app/admin/utilisateurs/actions";
import { RoleBadge } from "@/components/messages/role-badge";
import { Avatar } from "@/components/ui/avatar";
import { ProjectCard } from "@/components/users/project-card";
import { displayName, displaySubtitle, formatDate, formatPresence } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";
import { formatLanguages } from "@/lib/languages";
import { getUserProfile } from "@/lib/users";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const admin = await requireAdmin();
  const user = await getUserProfile(id, admin.id);
  return { title: user ? displayName(user) : "Profil introuvable" };
}

export default async function UserProfilePage({ params }: Props) {
  const { id } = await params;
  const admin = await requireAdmin();
  const user = await getUserProfile(id, admin.id);
  if (!user) notFound();

  const name = displayName(user);
  const subtitle = displaySubtitle(user);
  const online = user.status === "en_ligne";

  const info = [
    { Icon: Building2, label: "Lieu de travail", value: user.workplace },
    { Icon: Briefcase, label: "Poste", value: user.jobTitle },
    { Icon: MapPin, label: "Adresse", value: user.address },
    { Icon: Globe, label: "Pays", value: user.country },
    { Icon: Languages, label: "Langues", value: user.languages.length > 0 ? formatLanguages(user.languages) : null },
    { Icon: Mail, label: "E-mail", value: user.email, href: `mailto:${user.email}` },
    { Icon: CalendarDays, label: "Inscrit le", value: formatDate(user.createdAt) },
    { Icon: Clock3, label: "Dernière connexion", value: formatPresence(user.status, user.lastSeenAt) },
  ];

  const primaryButton =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-background shadow-lg shadow-accent/20 transition hover:bg-accent-strong";

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <Link
          href="/admin/utilisateurs"
          className="inline-flex items-center gap-2 rounded-lg text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Tous les utilisateurs
        </Link>

        {/* Carte d'identité */}
        <section className="mt-4 overflow-hidden rounded-[28px] border border-border/60 bg-surface-2/35">
          <div className="relative h-32 bg-gradient-to-br from-accent-strong/70 via-accent/40 to-emerald-900/40 md:h-40">
            <span
              aria-hidden
              className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle,rgba(255,255,255,.6)_1px,transparent_1.5px)] [background-size:22px_22px] [mask-image:linear-gradient(to_left,black,transparent_80%)]"
            />
          </div>
          <div className="flex flex-col gap-5 px-6 pb-6 md:flex-row md:items-end md:px-8">
            {/* Socle opaque : l'avatar est translucide et chevauche la bannière */}
            <div className="-mt-14 self-start rounded-full bg-surface p-1.5 md:-mt-16">
              <Avatar
                name={name}
                size="3xl"
                status={user.status}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{name}</h1>
                <RoleBadge role={user.role} />
              </div>
              {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted" suppressHydrationWarning>
                <span className={online ? "font-medium text-accent-strong" : undefined}>
                  {formatPresence(user.status, user.lastSeenAt)}
                </span>
                {user.city && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" /> {user.city}
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {user.conversationId ? (
                <Link href={`/admin/messages?c=${user.conversationId}`} className={primaryButton}>
                  <MessageSquareText className="size-4" /> Envoyer un message
                </Link>
              ) : (
                <form action={startConversation.bind(null, user.id)}>
                  <button type="submit" className={primaryButton}>
                    <MessageSquareText className="size-4" /> Envoyer un message
                  </button>
                </form>
              )}
              <a
                href={`mailto:${user.email}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background/30 px-5 py-3 text-sm font-medium transition-colors hover:border-accent/60 hover:text-accent-strong"
              >
                <Mail className="size-4" /> E-mail
              </a>
            </div>
          </div>

          {/* Compteurs */}
          <dl className="grid grid-cols-3 border-t border-border/60">
            {[
              ["Projets proposés", user.projectsTotal],
              ["En cours", user.projectsActive],
              ["Terminés", user.projectsDone],
            ].map(([label, value], i) => (
              <div
                key={label}
                className={`flex flex-col-reverse px-4 py-4 text-center md:px-8 ${i > 0 ? "border-l border-border/60" : ""}`}
              >
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="text-2xl font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Informations */}
          <aside className="h-fit rounded-[24px] border border-border/60 bg-surface-2/35 p-6">
            <h2 className="text-lg font-semibold">Informations</h2>
            <dl className="mt-4 space-y-4">
              {info.map(({ Icon, label, value, href }) => (
                <div key={label} className="flex gap-3">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-background">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted">{label}</dt>
                    <dd className="text-sm break-words" suppressHydrationWarning>
                      {value ? (
                        href ? (
                          <a href={href} className="hover:text-accent-strong hover:underline">
                            {value}
                          </a>
                        ) : (
                          value
                        )
                      ) : (
                        <span className="text-muted italic">Non renseigné</span>
                      )}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </aside>

          <div className="space-y-6 lg:col-span-2">
            {/* Description */}
            <section className="rounded-[24px] border border-border/60 bg-surface-2/35 p-6">
              <h2 className="text-lg font-semibold">À propos</h2>
              <p className="mt-3 leading-relaxed text-foreground/90">
                {user.description ?? <span className="text-muted italic">Aucune description.</span>}
              </p>
            </section>

            {/* Projets */}
            <section className="rounded-[24px] border border-border/60 bg-surface-2/35 p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="text-lg font-semibold">Projets proposés ({user.projects.length})</h2>
                <span className="text-xs text-muted">Projets non terminés en premier</span>
              </div>
              {user.projects.length === 0 ? (
                <p className="mt-4 rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
                  Cet utilisateur n&apos;a encore proposé aucun projet.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {user.projects.map((p) => (
                    <ProjectCard key={p.id} project={p} />
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
