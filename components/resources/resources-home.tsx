"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { ArrowRight, Folder, FolderPlus, Loader2, Search, Share2, X } from "lucide-react";
import { createFolder } from "@/lib/actions/resources";
import { attachmentUrl } from "@/lib/attachments";
import { formatRelative } from "@/lib/format";
import type { FileResource, FolderSummary, LinkResource, ResourceKind } from "@/lib/resources";
import type { Space } from "@/lib/types";
import { Empty, ResourceList, resourceSearchText, TYPE_FOLDERS, type Resource } from "./resource-items";

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

/**
 * Accueil des ressources : dossiers par type, dossiers personnels et partages récents.
 * `space` : espace de la page (admin ou user) ; `sharedWithMe` (espace utilisateur) :
 * ce que l'admin a partagé avec cette personne.
 */
export function ResourcesHome({
  files,
  links,
  folders,
  space,
  sharedWithMe,
}: {
  files: FileResource[];
  links: LinkResource[];
  folders: FolderSummary[];
  space: Space;
  sharedWithMe?: Resource[];
}) {
  const basePath = `/${space}/ressources`;
  const [search, setSearch] = useState("");
  const q = search.trim().toLocaleLowerCase("fr");

  const all = useMemo<Resource[]>(
    () => [...files, ...links].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [files, links],
  );
  const searchable = useMemo<Resource[]>(() => [...all, ...(sharedWithMe ?? [])], [all, sharedWithMe]);
  const counts = useMemo(() => {
    const c: Record<ResourceKind, number> = { photo: 0, video: 0, document: 0, audio: 0, lien: 0 };
    for (const r of all) c[r.kind]++;
    return c;
  }, [all]);

  const matchingItems = q ? searchable.filter((r) => resourceSearchText(r).includes(q)) : [];
  const matchingFolders = q ? folders.filter((f) => f.name.toLocaleLowerCase("fr").includes(q)) : folders;

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[28px] font-semibold tracking-tight">Ressources</h1>
          <div className="flex w-full flex-wrap gap-3 sm:w-auto">
            <label className="relative flex-1 sm:w-[340px] sm:flex-none">
              <span className="sr-only">Rechercher une ressource ou un dossier</span>
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Fichier, lien, personne, dossier…"
                className="w-full rounded-2xl border border-border bg-surface-2/50 py-3 pr-4 pl-11 text-sm placeholder:text-muted/70 focus:border-foreground/20 focus:outline-none"
              />
            </label>
            <NewFolderButton space={space} />
          </div>
        </header>

        {q ? (
          <div className="mt-8 space-y-10">
            {matchingFolders.length > 0 && (
              <section>
                <h2 className="mb-4 text-lg font-semibold">Dossiers</h2>
                <FolderGrid folders={matchingFolders} space={space} />
              </section>
            )}
            <section>
              <h2 className="mb-4 text-lg font-semibold">
                Ressources <span className="text-sm font-normal text-muted">({matchingItems.length})</span>
              </h2>
              {matchingItems.length > 0 ? (
                <ResourceList items={matchingItems.slice(0, 100)} />
              ) : (
                <Empty label="Aucune ressource ne correspond à la recherche." />
              )}
            </section>
          </div>
        ) : (
          <div className="mt-8 space-y-10">
            {/* Dossiers automatiques par type */}
            <section>
              <h2 className="mb-4 text-lg font-semibold">Par type</h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {TYPE_FOLDERS.map(({ kind, label, icon: Icon }) => (
                  <li key={kind}>
                    <Link
                      href={`${basePath}?type=${kind}`}
                      className="flex h-full flex-col gap-4 rounded-[22px] border border-border/60 bg-surface-2/35 p-5 transition-colors hover:border-accent/50 hover:bg-surface-2/60"
                    >
                      <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-surface-2/70 text-muted">
                        <Icon className="size-6" />
                      </span>
                      <span>
                        <span className="block font-semibold">{label}</span>
                        <span className="text-sm text-muted">{plural(counts[kind], "élément")}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            {/* Espace utilisateur : ce que l'admin a partagé avec la personne */}
            {sharedWithMe && (
              <section>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Share2 className="size-[18px] text-muted" aria-hidden /> Partagés avec vous{" "}
                    <span className="text-sm font-normal text-muted">({sharedWithMe.length})</span>
                  </h2>
                  {sharedWithMe.length > 4 && (
                    <Link
                      href={`${basePath}?type=partages`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-accent-strong hover:underline"
                    >
                      Tout voir <ArrowRight className="size-4" />
                    </Link>
                  )}
                </div>
                {sharedWithMe.length > 0 ? (
                  <ResourceList items={sharedWithMe.slice(0, 4)} />
                ) : (
                  <Empty
                    label="Rien n'a encore été partagé avec vous."
                    hint={
                      space === "admin"
                        ? "Les utilisateurs peuvent vous autoriser à voir des fichiers et des liens de leurs dossiers."
                        : "L'administration peut vous donner accès à des fichiers et des liens de ses dossiers."
                    }
                  />
                )}
              </section>
            )}

            {/* Dossiers personnels du compte connecté */}
            <section>
              <h2 className="mb-4 text-lg font-semibold">
                Mes dossiers <span className="text-sm font-normal text-muted">({folders.length})</span>
              </h2>
              <FolderGrid folders={folders} space={space} withCreate />
            </section>

            {/* Derniers partages */}
            <section>
              <h2 className="mb-1 text-lg font-semibold">Récemment partagés</h2>
              <p className="mb-4 text-sm text-muted">
                Les fichiers, photos, vidéos et liens envoyés dans les discussions arrivent ici automatiquement.
              </p>
              {all.length > 0 ? <ResourceList items={all.slice(0, 8)} /> : <Empty label="Rien n'a encore été partagé." />}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function FolderGrid({
  folders,
  space,
  withCreate = false,
}: {
  folders: FolderSummary[];
  space: Space;
  withCreate?: boolean;
}) {
  const basePath = `/${space}/ressources`;
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {folders.map((f) => (
        <li key={f.id}>
          <Link
            href={`${basePath}?dossier=${f.id}`}
            className="group flex h-full flex-col rounded-[22px] border border-border/60 bg-surface-2/35 p-3 transition-colors hover:border-accent/50 hover:bg-surface-2/60"
          >
            {/* Aperçu : quelques photos du dossier, sinon une icône */}
            <span className="relative flex h-32 items-center justify-center overflow-hidden rounded-2xl bg-background/40">
              {f.previews.length > 0 ? (
                <span className={`grid size-full gap-0.5 ${f.previews.length > 1 ? "grid-cols-2" : ""}`}>
                  {f.previews.slice(0, 4).map((id, i) => (
                    // eslint-disable-next-line @next/next/no-img-element -- aperçu d'un fichier privé
                    <img
                      key={id}
                      src={attachmentUrl(id)}
                      alt=""
                      loading="lazy"
                      // Avec 3 photos, la première occupe toute la hauteur : pas de case vide.
                      className={`size-full min-h-0 object-cover ${f.previews.length === 3 && i === 0 ? "row-span-2" : ""}`}
                    />
                  ))}
                </span>
              ) : (
                <Folder className="size-14 text-muted" strokeWidth={1.4} />
              )}
            </span>
            <span className="px-2 pt-3 pb-1">
              <span className="block truncate font-semibold group-hover:text-accent-strong">{f.name}</span>
              <span className="block text-xs text-muted" suppressHydrationWarning>
                {plural(f.count, "élément")} · modifié {formatRelative(f.updatedAt)}
              </span>
            </span>
          </Link>
        </li>
      ))}
      {withCreate && (
        <li>
          <NewFolderButton variant="card" space={space} />
        </li>
      )}
    </ul>
  );
}

/** Bouton « Nouveau dossier » + fenêtre de création ; ouvre le dossier une fois créé. */
function NewFolderButton({ variant = "button", space }: { variant?: "button" | "card"; space: Space }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open() {
    setName("");
    setError(null);
    dialogRef.current?.showModal();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createFolder(space, name);
      if (!res.ok) return setError(res.error);
      dialogRef.current?.close();
      router.push(`/${space}/ressources?dossier=${res.id}`);
    });
  }

  return (
    <>
      {variant === "card" ? (
        <button
          type="button"
          onClick={open}
          className="flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-border text-muted transition-colors hover:border-accent/60 hover:text-accent-strong"
        >
          <FolderPlus className="size-8" strokeWidth={1.6} />
          <span className="text-sm font-medium">Nouveau dossier</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={open}
          className="inline-flex items-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-background shadow-lg shadow-accent/20 transition hover:bg-accent-strong"
        >
          <FolderPlus className="size-4" /> Nouveau dossier
        </button>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="new-folder-title"
        onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}
        className="m-auto w-[min(92vw,420px)] rounded-[24px] border border-border bg-surface p-0 text-foreground shadow-2xl shadow-black/60 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <form onSubmit={submit} className="p-6">
          <div className="flex items-center gap-2">
            <h2 id="new-folder-title" className="mr-auto text-lg font-semibold">
              Nouveau dossier
            </h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Fermer"
              className="inline-flex size-9 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-foreground"
            >
              <X className="size-[18px]" />
            </button>
          </div>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm text-muted">Nom du dossier</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="Ex. Maquettes clients, Contrats 2026…"
              className="w-full rounded-xl border border-border bg-surface-2/50 px-3.5 py-2.5 text-sm placeholder:text-muted/70 focus:border-foreground/20 focus:outline-none"
            />
          </label>
          {error && (
            <p role="alert" className="mt-2 text-sm text-rose-300">
              {error}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-surface-2"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!name.trim() || pending}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background hover:bg-accent-strong disabled:opacity-50"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <FolderPlus className="size-4" />}
              Créer
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
