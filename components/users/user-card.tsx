import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { DeleteUserButton } from "@/components/users/delete-user-button";
import { displayName, displaySubtitle } from "@/lib/format";
import type { UserCard as UserCardData } from "@/lib/types";

export function UserCard({ user }: { user: UserCardData }) {
  const name = displayName(user);
  const subtitle = displaySubtitle(user);

  return (
    <article className="group relative flex flex-col rounded-[24px] border border-border/60 bg-surface-2/35 p-5 transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:bg-surface-2/60 hover:shadow-xl hover:shadow-black/30">
      {/* Identité */}
      <div className="mt-2 flex flex-col items-center text-center">
        <Avatar
          name={name}
          size="2xl"
          className="ring-4 ring-surface-2/80"
        />
        <h2 className="mt-3 line-clamp-1 text-lg font-semibold">{name}</h2>
        {subtitle && <p className="line-clamp-1 text-sm text-muted">{subtitle}</p>}
        {user.city && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted">
            <MapPin className="size-3.5 text-accent-strong" /> {user.city}
          </p>
        )}
      </div>

      {/* Dernier projet proposé */}
      <div className="mt-4 flex-1 rounded-xl border border-dashed border-border/70 px-3.5 py-3">
        <p className="text-[11px] tracking-wide text-muted uppercase">Projet proposé</p>
        {user.latestProject ? (
          <p className="mt-1 line-clamp-2 text-sm font-medium">{user.latestProject.title}</p>
        ) : (
          <p className="mt-1 text-sm text-muted italic">Aucun projet pour l&apos;instant</p>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        {/* Lien vers le profil : toute la carte est cliquable */}
        <Link
          href={`/admin/utilisateurs/${user.id}`}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background/30 py-2.5 text-sm font-medium transition-colors group-hover:border-accent group-hover:bg-accent group-hover:text-background after:absolute after:inset-0 after:rounded-[24px]"
        >
          Voir le profil
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          <span className="sr-only"> de {name}</span>
        </Link>
        {/* Au-dessus du lien étiré grâce à z-10 */}
        <DeleteUserButton userId={user.id} name={name} />
      </div>
    </article>
  );
}
