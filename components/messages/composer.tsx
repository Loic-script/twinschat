"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { FileText, ImagePlus, Link2, Loader2, Paperclip, SendHorizontal, Upload, X } from "lucide-react";
import { sendMessage } from "@/lib/actions/messages";
import {
  ACCEPT_ALL,
  ACCEPT_MEDIA,
  attachmentKind,
  checkFile,
  formatFileSize,
  MAX_FILES_PER_MESSAGE,
  resolveMime,
} from "@/lib/attachments";
import type { Message, Space } from "@/lib/types";

type PendingFile = { key: string; file: File; mime: string; previewUrl: string | null };
type OptimisticMessage = Message & { pending?: boolean };

const randomKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

/** Ajoute https:// si besoin et vérifie qu'il s'agit d'une adresse web. */
function normalizeUrl(value: string) {
  const raw = value.trim();
  if (!raw) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Zone de saisie : texte, pièces jointes (bouton, glisser-déposer, coller) et liens.
 * Les fichiers sont d'abord déposés via POST /api/fichiers, puis rattachés au message.
 */
export function Composer({
  conversationId,
  meId,
  meName,
  label,
  placeholder,
  addOptimistic,
  onSending,
  space,
}: {
  conversationId: string;
  meId: string;
  meName: string;
  label: string;
  placeholder: string;
  addOptimistic: (message: OptimisticMessage) => void;
  onSending?: () => void;
  /** Espace de la page (admin ou user) : désigne le compte qui envoie. */
  space: Space;
}) {
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [sending, startTransition] = useTransition();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const filesRef = useRef(files);
  filesRef.current = files;

  // Libère les aperçus locaux en quittant la discussion.
  useEffect(
    () => () => filesRef.current.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl)),
    [],
  );

  // Fermeture du menu / du formulaire de lien au clic extérieur et avec Échap.
  useEffect(() => {
    if (!menuOpen && !linkOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
        setLinkOpen(false);
      }
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setLinkOpen(false);
        textareaRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, linkOpen]);

  function addFiles(list: FileList | File[]) {
    const errors: string[] = [];
    const accepted: PendingFile[] = [];
    for (const file of Array.from(list)) {
      const problem = checkFile(file);
      if (problem) {
        errors.push(problem);
        continue;
      }
      if (files.length + accepted.length >= MAX_FILES_PER_MESSAGE) {
        errors.push(`${MAX_FILES_PER_MESSAGE} fichiers maximum par message.`);
        break;
      }
      const mime = resolveMime(file.name, file.type);
      const kind = attachmentKind(mime);
      accepted.push({
        key: randomKey(),
        file,
        mime,
        previewUrl: kind === "image" || kind === "video" ? URL.createObjectURL(file) : null,
      });
    }
    if (accepted.length) setFiles((prev) => [...prev, ...accepted]);
    setError(errors.length ? errors.join(" ") : null);
    textareaRef.current?.focus();
  }

  function removeFile(key: string) {
    setFiles((prev) => {
      const target = prev.find((f) => f.key === key);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.key !== key);
    });
  }

  function insertLink(e?: { preventDefault(): void }) {
    e?.preventDefault();
    const url = normalizeUrl(linkUrl);
    if (!url) {
      setError("Adresse invalide. Exemple : https://monsite.com");
      return;
    }
    const text = linkText.trim();
    setDraft((d) => `${d.trimEnd()}${d.trim() ? " " : ""}${text ? `${text} : ` : ""}${url}`);
    setLinkUrl("");
    setLinkText("");
    setLinkOpen(false);
    setError(null);
    textareaRef.current?.focus();
  }

  function send() {
    const body = draft.trim();
    if ((!body && files.length === 0) || sending) return;
    const batch = files;
    setDraft("");
    setFiles([]);
    setError(null);
    setMenuOpen(false);
    onSending?.();

    const restore = (message: string) => {
      setDraft(body);
      setFiles(batch);
      setError(message);
    };

    startTransition(async () => {
      addOptimistic({
        id: `tmp-${Date.now()}`,
        body,
        senderId: meId,
        senderName: meName,
        pinned: false,
        createdAt: new Date().toISOString(),
        editedAt: null,
        deleted: false,
        pending: true,
        reactions: [],
        attachments: batch.map((p) => ({
          id: p.key,
          name: p.file.name,
          mimeType: p.mime,
          size: p.file.size,
          localUrl: p.previewUrl ?? undefined,
        })),
      });

      let attachmentIds: string[] = [];
      if (batch.length > 0) {
        const form = new FormData();
        form.append("conversationId", conversationId);
        form.append("space", space);
        batch.forEach((p) => form.append("files", p.file));
        try {
          const res = await fetch("/api/fichiers", { method: "POST", body: form });
          const json = await res.json().catch(() => null);
          if (!res.ok) throw new Error(json?.error ?? "Envoi des fichiers impossible.");
          attachmentIds = (json.attachments as { id: string }[]).map((a) => a.id);
        } catch (err) {
          restore(err instanceof Error ? err.message : "Envoi des fichiers impossible.");
          return;
        }
      }

      const res = await sendMessage(space, conversationId, body, attachmentIds);
      if (!res.ok) {
        restore(res.error);
        return;
      }
      // Les aperçus locaux sont remplacés par les fichiers du serveur : on les libère ensuite.
      setTimeout(() => batch.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl)), 10_000);
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    if (e.clipboardData.files.length > 0) {
      e.preventDefault();
      addFiles(e.clipboardData.files);
    }
  }

  const hasFilesDrag = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  const menuItem =
    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-surface-2";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      onDragOver={(e) => {
        if (!hasFilesDrag(e)) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
      }}
      onDrop={(e) => {
        if (!hasFilesDrag(e)) return;
        e.preventDefault();
        setDragOver(false);
        addFiles(e.dataTransfer.files);
      }}
      className="relative px-4 pb-5 md:px-8"
    >
      {error && (
        <p role="alert" className="mb-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      {/* Entrées de fichiers cachées, déclenchées par le menu */}
      <input
        ref={mediaInputRef}
        type="file"
        accept={ACCEPT_MEDIA}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_ALL}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div
        className={`relative rounded-2xl border bg-surface-2/60 transition-colors ${
          dragOver ? "border-dashed border-accent" : "border-border/60 focus-within:border-foreground/20"
        }`}
      >
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-2xl bg-surface/90 text-sm font-medium text-accent-strong">
            <Upload className="size-5" /> Déposez vos fichiers ici
          </div>
        )}

        {/* Fichiers en attente d'envoi */}
        {files.length > 0 && (
          <ul className="flex flex-wrap gap-2 px-3 pt-3" aria-label="Fichiers joints">
            {files.map((p) => {
              const kind = attachmentKind(p.mime);
              return (
                <li key={p.key} className="relative">
                  {p.previewUrl ? (
                    kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:)
                      <img src={p.previewUrl} alt={p.file.name} className="size-16 rounded-xl object-cover" />
                    ) : (
                      <video src={p.previewUrl} muted className="size-16 rounded-xl bg-black object-cover" />
                    )
                  ) : (
                    <span className="flex h-16 max-w-[220px] items-center gap-2.5 rounded-xl bg-background/50 pr-8 pl-3">
                      <FileText className="size-5 shrink-0 text-muted" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{p.file.name}</span>
                        <span className="block text-xs text-muted">{formatFileSize(p.file.size)}</span>
                      </span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFile(p.key)}
                    aria-label={`Retirer ${p.file.name}`}
                    className="absolute -top-1.5 -right-1.5 inline-flex size-6 items-center justify-center rounded-full border-2 border-surface bg-foreground text-background hover:bg-rose-300"
                  >
                    <X className="size-3.5" strokeWidth={3} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex items-end gap-2 py-2 pr-2 pl-2">
          {/* Menu « joindre » */}
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setLinkOpen(false);
                setMenuOpen((v) => !v);
              }}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Joindre un fichier ou un lien"
              title="Joindre"
              className={`inline-flex size-12 items-center justify-center rounded-xl transition-colors ${
                menuOpen || linkOpen ? "bg-surface-2 text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <Paperclip className="size-5" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute bottom-full left-0 z-20 mb-2 w-56 rounded-2xl border border-border bg-surface p-1.5 shadow-2xl shadow-black/60"
              >
                <button
                  type="button"
                  role="menuitem"
                  className={menuItem}
                  onClick={() => {
                    setMenuOpen(false);
                    mediaInputRef.current?.click();
                  }}
                >
                  <ImagePlus className="size-[18px] text-accent-strong" /> Photo ou vidéo
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={menuItem}
                  onClick={() => {
                    setMenuOpen(false);
                    fileInputRef.current?.click();
                  }}
                >
                  <FileText className="size-[18px] text-accent-strong" /> Fichier
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={menuItem}
                  onClick={() => {
                    setMenuOpen(false);
                    setLinkOpen(true);
                  }}
                >
                  <Link2 className="size-[18px] text-accent-strong" /> Lien
                </button>
              </div>
            )}

            {linkOpen && (
              <div className="absolute bottom-full left-0 z-20 mb-2 w-[min(340px,80vw)] rounded-2xl border border-border bg-surface p-4 shadow-2xl shadow-black/60">
                <p className="mb-3 text-sm font-semibold">Ajouter un lien</p>
                {/* Pas de <form> imbriqué : validation via le bouton et la touche Entrée */}
                <div
                  className="space-y-2"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") insertLink(e);
                  }}
                >
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted">Adresse</span>
                    <input
                      autoFocus
                      type="text"
                      inputMode="url"
                      spellCheck={false}
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://…"
                      className="w-full rounded-xl border border-border bg-surface-2/50 px-3 py-2 text-sm placeholder:text-muted/70 focus:border-foreground/20 focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted">Texte affiché (facultatif)</span>
                    <input
                      type="text"
                      value={linkText}
                      onChange={(e) => setLinkText(e.target.value)}
                      placeholder="Ex. Maquette du site"
                      className="w-full rounded-xl border border-border bg-surface-2/50 px-3 py-2 text-sm placeholder:text-muted/70 focus:border-foreground/20 focus:outline-none"
                    />
                  </label>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setLinkOpen(false)}
                      className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-foreground"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={insertLink}
                      disabled={!linkUrl.trim()}
                      className="rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-background hover:bg-accent-strong disabled:opacity-50"
                    >
                      Insérer
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <label htmlFor="composer" className="sr-only">
            {label}
          </label>
          <textarea
            ref={textareaRef}
            id="composer"
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            maxLength={4000}
            placeholder={placeholder}
            className="max-h-40 min-h-12 flex-1 resize-none bg-transparent py-3 text-[15px] leading-6 [field-sizing:content] placeholder:text-muted/70 focus:outline-none focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={(!draft.trim() && files.length === 0) || sending}
            aria-label="Envoyer le message"
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-background shadow-lg shadow-accent/20 transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {sending ? <Loader2 className="size-5 animate-spin" /> : <SendHorizontal className="size-5" />}
          </button>
        </div>
      </div>
      <p className="mt-2 hidden text-xs text-muted/80 md:block">
        Entrée pour envoyer · Maj + Entrée pour aller à la ligne · Glissez-déposez ou collez des fichiers
      </p>
    </form>
  );
}
