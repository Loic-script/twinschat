"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Check,
  Download,
  ExternalLink,
  FileArchive,
  FileAudio,
  FileSpreadsheet,
  FileText,
  Film,
  FolderOpen,
  Globe,
  ImageIcon,
  Link2,
  MessageSquareText,
  Music,
  Play,
  Lock,
  ShieldCheck,
  Share2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { ProjectIcon } from "@/components/brand/project-icon";
import { attachmentUrl, downloadUrl, formatFileSize, isInlineMime } from "@/lib/attachments";
import { displayName, formatRelative } from "@/lib/format";
import type { FileResource, LinkResource, ResourceKind, ResourceSource } from "@/lib/resources";

export type Resource = FileResource | LinkResource;

/** Dossiers automatiques, un par type de ressource. */
export const TYPE_FOLDERS: { kind: ResourceKind; label: string; icon: LucideIcon }[] = [
  { kind: "photo", label: "Photos", icon: ImageIcon },
  { kind: "video", label: "Vidéos", icon: Film },
  { kind: "document", label: "Documents", icon: FileText },
  { kind: "audio", label: "Audio", icon: Music },
  { kind: "lien", label: "Liens", icon: Link2 },
];

export function documentIcon(mime: string): LucideIcon {
  if (/zip|rar|7z/.test(mime)) return FileArchive;
  if (/sheet|excel|csv/.test(mime)) return FileSpreadsheet;
  if (mime.startsWith("audio/")) return FileAudio;
  if (mime.startsWith("video/")) return Film;
  return FileText;
}

function extension(name: string) {
  const ext = name.split(".").pop();
  return ext && ext !== name ? ext.toUpperCase() : "FICHIER";
}

/** « Vous » pour le compte qui consulte, sinon le nom (ou la société). */
export function senderLabel(sender: Resource["sender"]) {
  return sender.isMe ? "Vous" : displayName(sender);
}

export function resourceSearchText(r: Resource) {
  const base = [senderLabel(r.sender), r.sender.name, r.source?.label ?? ""];
  const own = r.kind === "lien" ? [r.url, r.title ?? ""] : [r.name];
  return [...base, ...own].join(" ").toLocaleLowerCase("fr");
}

export function Empty({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[24px] border border-dashed border-border px-6 py-14 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-accent text-background">
        <FolderOpen className="size-7" strokeWidth={1.6} />
      </span>
      <p className="text-sm text-muted">{label}</p>
      {hint && <p className="max-w-md text-xs text-muted/80">{hint}</p>}
    </div>
  );
}

export function SourceLink({ source, sharedBy }: { source: ResourceSource | null; sharedBy?: string }) {
  if (sharedBy) {
    return (
      <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border/70 bg-surface-2/40 px-2 py-0.5 text-[11px] text-foreground/80">
        <Share2 className="size-3 shrink-0" /> <span className="truncate">Partagé par {sharedBy}</span>
      </span>
    );
  }
  if (!source) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-surface-2/40 px-2 py-0.5 text-[11px] text-muted">
        <FolderOpen className="size-3 shrink-0" /> Importé
      </span>
    );
  }
  return (
    <Link
      href={source.href}
      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border/70 bg-surface-2/40 px-2 py-0.5 text-[11px] text-foreground/80 hover:border-accent/50 hover:text-accent-strong"
      title="Voir dans la discussion"
    >
      {source.type === "projet" ? (
        <ProjectIcon className="size-3 shrink-0" />
      ) : (
        <MessageSquareText className="size-3 shrink-0" />
      )}
      <span className="truncate">{source.label}</span>
    </Link>
  );
}

/** Bouton « retirer » avec confirmation en deux temps (pas de boîte de dialogue). */
function RemoveButton({ label, onRemove, className = "" }: { label: string; onRemove: () => void; className?: string }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <button
      type="button"
      onClick={() => (confirming ? onRemove() : setConfirming(true))}
      onBlur={() => setConfirming(false)}
      aria-label={confirming ? `Confirmer : ${label}` : label}
      title={confirming ? "Cliquer à nouveau pour confirmer" : label}
      className={`inline-flex shrink-0 items-center justify-center gap-1 rounded-xl text-xs font-medium transition-colors ${
        confirming ? "bg-rose-500 px-2.5 text-white" : "text-muted hover:bg-rose-500/10 hover:text-rose-300"
      } ${className}`}
    >
      {confirming ? (
        <>
          <Check className="size-3.5" /> Retirer
        </>
      ) : (
        <X className="size-4" />
      )}
    </button>
  );
}

/**
 * Partage d'un élément de dossier :
 * - `users` (admin) : « Vous seul » ou le nombre de personnes, ouvre la fenêtre de partage ;
 * - `admin` (utilisateur) : « Privé » ou « Admin autorisé », bascule l'accès de l'administration.
 */
export type ShareMode = "users" | "admin";

function AccessChip({
  resource,
  onShare,
  mode = "users",
  overlay = false,
}: {
  resource: Resource;
  onShare: (r: Resource) => void;
  mode?: ShareMode;
  /** Sur une vignette de la galerie (fond sombre semi-transparent). */
  overlay?: boolean;
}) {
  const access = resource.access ?? [];
  const name = resource.kind === "lien" ? resource.title || resource.host : resource.name;
  const adminAllowed = access.some((u) => u.role === "admin");
  const count = access.length;

  const { label, aria, title, Icon } =
    mode === "admin"
      ? {
          label: adminAllowed ? "Admin autorisé" : "Privé",
          aria: adminAllowed
            ? `Retirer l'accès de l'administration à ${name}`
            : `Autoriser l'administration à voir ${name}`,
          title: adminAllowed ? "Retirer l'accès de l'administration" : "Autoriser l'administration",
          Icon: adminAllowed ? ShieldCheck : Lock,
        }
      : {
          label: count === 0 ? "Vous seul" : `${count} personne${count > 1 ? "s" : ""}`,
          aria: `Gérer l'accès à ${name} (${count === 0 ? "vous seul" : `${count} personne${count > 1 ? "s" : ""}`})`,
          title: "Gérer l'accès",
          Icon: count === 0 ? Lock : Users,
        };

  return (
    <button
      type="button"
      onClick={() => onShare(resource)}
      aria-label={aria}
      aria-pressed={mode === "admin" ? adminAllowed : undefined}
      title={title}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
        overlay
          ? "bg-black/60 text-white hover:bg-black/80"
          : "border border-border/70 bg-surface-2/40 text-foreground/80 hover:border-accent/50 hover:text-accent-strong"
      }`}
    >
      <Icon className="size-3" />
      {label}
    </button>
  );
}

/** Photos et vidéos en mosaïque ; au survol : nom, auteur et provenance. */
export function Gallery({
  items,
  onRemove,
  onShare,
  shareMode,
}: {
  items: FileResource[];
  onRemove?: (r: Resource) => void;
  onShare?: (r: Resource) => void;
  shareMode?: ShareMode;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
      {items.map((r) => (
        <li key={r.itemId ?? r.id} className="group relative aspect-square overflow-hidden rounded-2xl border border-border/60 bg-surface-2">
          {r.kind === "photo" ? (
            // eslint-disable-next-line @next/next/no-img-element -- fichiers privés servis par l'API
            <img
              src={attachmentUrl(r.id)}
              alt={r.name}
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <>
              <video src={attachmentUrl(r.id)} preload="metadata" muted className="size-full object-cover" />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="inline-flex size-12 items-center justify-center rounded-full bg-black/60 text-white">
                  <Play className="size-5 translate-x-0.5" fill="currentColor" />
                </span>
              </span>
            </>
          )}
          <a
            href={attachmentUrl(r.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0"
            aria-label={`Ouvrir ${r.name}`}
          />
          {onShare && (
            <div className="absolute top-2 left-2 z-10">
              <AccessChip resource={r} onShare={onShare} mode={shareMode} overlay />
            </div>
          )}
          {/* Actions : télécharger, retirer du dossier (au survol ; toujours visibles sur écran tactile) */}
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
            <a
              href={downloadUrl(r.id)}
              download={r.name}
              aria-label={`Télécharger ${r.name}`}
              title="Télécharger"
              className="inline-flex size-8 items-center justify-center rounded-xl bg-black/60 text-white transition-colors hover:bg-accent hover:text-background"
            >
              <Download className="size-4" />
            </a>
            {onRemove && (
              <RemoveButton
                label={`Retirer ${r.name} du dossier`}
                onRemove={() => onRemove(r)}
                className="h-8 min-w-8 bg-black/60 text-white hover:bg-rose-500 hover:text-white"
              />
            )}
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-3 pt-10 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <p className="truncate text-sm font-medium text-white">{r.name}</p>
            <p className="truncate text-xs text-white/75" suppressHydrationWarning>
              {senderLabel(r.sender)} · {formatRelative(r.createdAt)}
            </p>
            <div className="pointer-events-auto mt-2">
              <SourceLink source={r.source} sharedBy={r.sharedBy} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Liste de ressources de tous types (photo en vignette, sinon icône). */
export function ResourceList({
  items,
  onRemove,
  onShare,
  shareMode,
}: {
  items: Resource[];
  onRemove?: (r: Resource) => void;
  onShare?: (r: Resource) => void;
  shareMode?: ShareMode;
}) {
  const actionButton =
    "inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-foreground";
  return (
    <ul className="divide-y divide-border/50 overflow-hidden rounded-[20px] border border-border/60 bg-surface-2/25">
      {items.map((r) => {
        const isLink = r.kind === "lien";
        const Icon = isLink ? Globe : documentIcon(r.mimeType);
        const href = isLink ? r.url : attachmentUrl(r.id);
        const opensInline = isLink || isInlineMime(r.mimeType);
        const title = isLink ? r.title || r.host : r.name;
        const target = opensInline ? { target: "_blank", rel: "noopener noreferrer" } : { download: r.name };
        return (
          <li key={r.itemId ?? r.id} className="flex items-center gap-4 px-4 py-3.5 md:px-5">
            {r.kind === "photo" ? (
              // eslint-disable-next-line @next/next/no-img-element -- vignette d'un fichier privé
              <img src={attachmentUrl(r.id)} alt="" loading="lazy" className="size-11 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2/70 text-muted">
                <Icon className="size-5" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <a href={href} {...target} className="block truncate text-sm font-medium hover:text-accent-strong hover:underline">
                {title}
              </a>
              <p className="truncate text-xs text-muted" suppressHydrationWarning>
                {isLink ? r.url.replace(/^https?:\/\//, "") : `${extension(r.name)} · ${formatFileSize(r.size)}`}
                {" · "}
                {senderLabel(r.sender)} · {formatRelative(r.createdAt)}
              </p>
              {r.kind === "audio" && (
                <audio src={attachmentUrl(r.id)} controls preload="none" className="mt-2 h-9 w-full max-w-sm" />
              )}
            </div>
            {onShare && <AccessChip resource={r} onShare={onShare} mode={shareMode} />}
            <div className="hidden max-w-[220px] md:block">
              <SourceLink source={r.source} sharedBy={r.sharedBy} />
            </div>
            {opensInline && (
              <a href={href} {...target} className={actionButton} aria-label={`Ouvrir ${title}`} title="Ouvrir">
                <ExternalLink className="size-4" />
              </a>
            )}
            {!isLink && (
              <a
                href={downloadUrl(r.id)}
                download={r.name}
                className={actionButton}
                aria-label={`Télécharger ${title}`}
                title="Télécharger"
              >
                <Download className="size-4" />
              </a>
            )}
            {onRemove && <RemoveButton label={`Retirer ${title} du dossier`} onRemove={() => onRemove(r)} className="h-9 min-w-9" />}
          </li>
        );
      })}
    </ul>
  );
}

/** Ressources réparties en sections : photos/vidéos, documents/audio, liens. */
export function ResourceSections({
  items,
  onRemove,
  onShare,
  shareMode,
  limits,
}: {
  items: Resource[];
  onRemove?: (r: Resource) => void;
  onShare?: (r: Resource) => void;
  shareMode?: ShareMode;
  /** Nombre maximal d'éléments par section (aperçu). */
  limits?: { media: number; docs: number; links: number };
}) {
  const media = items.filter((r) => r.kind === "photo" || r.kind === "video") as FileResource[];
  const docs = items.filter((r) => r.kind === "document" || r.kind === "audio");
  const links = items.filter((r) => r.kind === "lien");
  const cut = <T,>(list: T[], n?: number) => (n ? list.slice(0, n) : list);
  return (
    <div className="space-y-10">
      {media.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">
            Photos et vidéos <span className="text-sm font-normal text-muted">({media.length})</span>
          </h2>
          <Gallery items={cut(media, limits?.media)} onRemove={onRemove} onShare={onShare} shareMode={shareMode} />
        </section>
      )}
      {docs.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">
            Documents et audio <span className="text-sm font-normal text-muted">({docs.length})</span>
          </h2>
          <ResourceList items={cut(docs, limits?.docs)} onRemove={onRemove} onShare={onShare} shareMode={shareMode} />
        </section>
      )}
      {links.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">
            Liens <span className="text-sm font-normal text-muted">({links.length})</span>
          </h2>
          <ResourceList items={cut(links, limits?.links)} onRemove={onRemove} onShare={onShare} shareMode={shareMode} />
        </section>
      )}
    </div>
  );
}
