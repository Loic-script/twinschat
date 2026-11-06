import { Download, ExternalLink, FileArchive, FileSpreadsheet, FileText, Globe, type LucideIcon } from "lucide-react";
import { attachmentKind, attachmentUrl, formatFileSize, isInlineMime } from "@/lib/attachments";
import type { MessageAttachment } from "@/lib/types";

function fileIcon(mime: string): LucideIcon {
  if (/zip|rar|7z/.test(mime)) return FileArchive;
  if (/sheet|excel|csv/.test(mime)) return FileSpreadsheet;
  return FileText;
}

function extension(name: string) {
  const ext = name.split(".").pop();
  return ext && ext !== name ? ext.toUpperCase() : "FICHIER";
}

/** Photos, vidéos, sons et documents joints à un message. */
export function MessageAttachments({
  attachments,
  mine,
  pending = false,
}: {
  attachments: MessageAttachment[];
  mine: boolean;
  /** Message en cours d'envoi : les fichiers ne sont pas encore servis par le serveur. */
  pending?: boolean;
}) {
  const src = (a: MessageAttachment) => a.localUrl ?? attachmentUrl(a.id);
  const media = attachments.filter((a) => ["image", "video"].includes(attachmentKind(a.mimeType)));
  const audios = attachments.filter((a) => attachmentKind(a.mimeType) === "audio");
  const files = attachments.filter((a) => attachmentKind(a.mimeType) === "fichier");

  return (
    <div className="flex flex-col gap-2 whitespace-normal">
      {media.length > 0 && (
        <div className={`grid gap-1.5 ${media.length > 1 ? "grid-cols-2" : ""}`}>
          {media.map((a) =>
            attachmentKind(a.mimeType) === "image" ? (
              <a
                key={a.id}
                href={pending ? undefined : src(a)}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-2xl bg-background/30"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- fichiers privés servis par l'API */}
                <img
                  src={src(a)}
                  alt={a.name}
                  loading="lazy"
                  className={`w-full object-cover ${media.length > 1 ? "aspect-square" : "max-h-80"}`}
                />
              </a>
            ) : (
              <video
                key={a.id}
                src={src(a)}
                controls
                preload="metadata"
                className="max-h-80 w-full rounded-2xl bg-black"
              />
            ),
          )}
        </div>
      )}

      {audios.map((a) => (
        <audio key={a.id} src={src(a)} controls preload="metadata" className="w-72 max-w-full" />
      ))}

      {files.map((a) => {
        const Icon = fileIcon(a.mimeType);
        const inline = isInlineMime(a.mimeType);
        return (
          <a
            key={a.id}
            href={pending ? undefined : attachmentUrl(a.id)}
            {...(inline ? { target: "_blank", rel: "noopener noreferrer" } : { download: a.name })}
            className={`flex min-w-[220px] items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
              mine ? "bg-background/15 hover:bg-background/25" : "bg-background/40 hover:bg-background/60"
            }`}
          >
            <span
              className={`inline-flex size-10 shrink-0 items-center justify-center rounded-lg ${
                mine ? "bg-background/20" : "bg-surface-2"
              }`}
            >
              <Icon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{a.name}</span>
              <span className="block text-xs opacity-70">
                {extension(a.name)} · {formatFileSize(a.size)}
              </span>
            </span>
            {!pending && (inline ? <ExternalLink className="size-4 shrink-0 opacity-70" /> : <Download className="size-4 shrink-0 opacity-70" />)}
          </a>
        );
      })}
    </div>
  );
}

const FIRST_URL_RE = /(?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)\]'"]/i;

/** Carte du premier lien d'un message (domaine + adresse), sans appel externe. */
export function LinkPreview({ body, mine }: { body: string; mine: boolean }) {
  const match = body.match(FIRST_URL_RE)?.[0];
  if (!match) return null;
  let url: URL;
  try {
    url = new URL(match.startsWith("http") ? match : `https://${match}`);
  } catch {
    return null;
  }
  return (
    <a
      href={url.toString()}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-2.5 flex items-center gap-3 rounded-xl px-3 py-2.5 whitespace-normal no-underline transition-colors ${
        mine ? "bg-background/15 hover:bg-background/25" : "bg-background/40 hover:bg-background/60"
      }`}
    >
      <span
        className={`inline-flex size-10 shrink-0 items-center justify-center rounded-lg ${
          mine ? "bg-background/20" : "bg-surface-2"
        }`}
      >
        <Globe className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{url.hostname.replace(/^www\./, "")}</span>
        <span className="block truncate text-xs opacity-70">{url.toString().replace(/^https?:\/\//, "")}</span>
      </span>
      <ExternalLink className="size-4 shrink-0 opacity-70" />
    </a>
  );
}
