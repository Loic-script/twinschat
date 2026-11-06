"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Search, Share2 } from "lucide-react";
import type { FileResource, ResourceKind } from "@/lib/resources";
import type { Space } from "@/lib/types";
import {
  Empty,
  Gallery,
  ResourceList,
  ResourceSections,
  resourceSearchText,
  TYPE_FOLDERS,
  type Resource,
} from "./resource-items";

/** Fil d'Ariane « Ressources › … ». `basePath` : page Ressources de l'espace courant. */
export function Breadcrumb({ current, basePath = "/admin/ressources" }: { current: string; basePath?: string }) {
  return (
    <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-sm text-muted">
      <Link href={basePath} className="rounded-md hover:text-foreground">
        Ressources
      </Link>
      <ChevronRight className="size-4" aria-hidden />
      <span aria-current="page" className="truncate text-foreground">
        {current}
      </span>
    </nav>
  );
}

/** Collection « partagés avec vous » (espace utilisateur). */
const SHARED_FOLDER = { label: "Partagés avec vous", icon: Share2 };

/**
 * Dossier automatique d'un type : galerie (photos, vidéos) ou liste (documents, audio, liens).
 * `kind="partages"` : ce que l'admin a partagé avec l'utilisateur, tous types confondus.
 */
export function CollectionView({
  kind,
  items,
  space,
}: {
  kind: ResourceKind | "partages";
  items: Resource[];
  /** Espace de la page (admin ou user) : lien de retour du fil d'Ariane. */
  space: Space;
}) {
  const basePath = `/${space}/ressources`;
  const [search, setSearch] = useState("");
  const shared = kind === "partages";
  const folder = shared ? SHARED_FOLDER : TYPE_FOLDERS.find((t) => t.kind === kind)!;
  const Icon = folder.icon;
  const q = search.trim().toLocaleLowerCase("fr");
  const visible = useMemo(() => (q ? items.filter((r) => resourceSearchText(r).includes(q)) : items), [items, q]);

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <Breadcrumb current={folder.label} basePath={basePath} />
        <header className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-surface-2/70 text-muted">
              <Icon className="size-6" />
            </span>
            <div>
              <h1 className="text-[26px] leading-tight font-semibold tracking-tight">{folder.label}</h1>
              <p className="text-sm text-muted">
                {items.length} élément{items.length > 1 ? "s" : ""} partagé{items.length > 1 ? "s" : ""}{" "}
                {shared ? (space === "admin" ? "avec vous par les utilisateurs" : "avec vous par l'administration") : "dans les discussions"}
              </p>
            </div>
          </div>
          <label className="relative w-full sm:w-[340px]">
            <span className="sr-only">Rechercher dans {folder.label}</span>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={shared ? "Rechercher un fichier ou un lien…" : `Rechercher dans ${folder.label.toLowerCase()}…`}
              className="w-full rounded-2xl border border-border bg-surface-2/50 py-3 pr-4 pl-11 text-sm placeholder:text-muted/70 focus:border-foreground/20 focus:outline-none"
            />
          </label>
        </header>

        <div className="mt-8">
          {visible.length === 0 ? (
            <Empty
              label={
                q
                  ? "Aucun élément ne correspond à la recherche."
                  : shared
                    ? "Rien n'a encore été partagé avec vous."
                    : `Aucun élément dans ${folder.label.toLowerCase()} pour l'instant.`
              }
              hint={
                shared
                  ? space === "admin"
                    ? "Les utilisateurs peuvent vous autoriser à voir des fichiers et des liens de leurs dossiers."
                    : "L'administration peut partager avec vous des fichiers et des liens de ses dossiers."
                  : "Ce dossier se remplit automatiquement avec ce qui est envoyé dans les discussions."
              }
            />
          ) : shared ? (
            <ResourceSections items={visible} />
          ) : kind === "photo" || kind === "video" ? (
            <Gallery items={visible as FileResource[]} />
          ) : (
            <ResourceList items={visible} />
          )}
        </div>
      </div>
    </div>
  );
}
