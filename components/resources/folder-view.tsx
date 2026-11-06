"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type DragEvent, type FormEvent, type ReactNode, type RefObject } from "react";
import {
  Check,
  ChevronDown,
  Folder,
  Globe,
  Link2,
  Loader2,
  MessageSquareText,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  UserMinus,
  X,
} from "lucide-react";
import {
  addLinkToFolder,
  addSharedToFolder,
  deleteFolder,
  grantItemAccess,
  removeFolderItem,
  renameFolder,
  revokeItemAccess,
  setAdminAccess,
} from "@/lib/actions/resources";
import { Avatar } from "@/components/ui/avatar";
import { displayName, ROLE_LABELS } from "@/lib/format";
import { ACCEPT_ALL, attachmentUrl, checkFile, MAX_FILES_PER_MESSAGE } from "@/lib/attachments";
import type { AccessUser, FileResource, LinkResource, ResourceKind } from "@/lib/resources";
import type { Space } from "@/lib/types";
import { Breadcrumb } from "./collection-view";
import { documentIcon, Empty, ResourceSections, resourceSearchText, senderLabel, TYPE_FOLDERS, type Resource } from "./resource-items";

type FolderData = { id: string; name: string; files: FileResource[]; links: LinkResource[] };

/** Dossier personnel : import de fichiers, ajout de liens, ajout depuis les discussions. */
export function FolderView({
  folder,
  shared,
  users,
  space,
}: {
  folder: FolderData;
  shared: { files: FileResource[]; links: LinkResource[] };
  /**
   * Utilisateurs à qui l'on peut donner l'accès aux éléments du dossier (admin).
   * Absent dans l'espace utilisateur : pas de partage, le dossier reste privé.
   */
  users?: AccessUser[];
  /** Espace de la page (admin ou user) : propriétaire du dossier et liens de retour. */
  space: Space;
}) {
  const basePath = `/${space}/ressources`;
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(folder.name);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [, startTransition] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const linkDialog = useRef<HTMLDialogElement>(null);
  const pickerDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const shareDialog = useRef<HTMLDialogElement>(null);
  const [shareItemId, setShareItemId] = useState<string | null>(null);

  function openShare(r: Resource) {
    if (!r.itemId) return;
    setShareItemId(r.itemId);
    shareDialog.current?.showModal();
  }

  /** Espace utilisateur : autorise ou retire l'accès de l'administration à l'élément. */
  function toggleAdminAccess(r: Resource) {
    if (!r.itemId) return;
    const allow = !(r.access ?? []).some((u) => u.role === "admin");
    setError(null);
    startTransition(async () => {
      const res = await setAdminAccess(r.itemId!, allow);
      if (!res.ok) setError(res.error);
    });
  }

  const items = useMemo<Resource[]>(
    () => [...folder.files, ...folder.links].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [folder.files, folder.links],
  );

  // Ressources partagées pas encore dans ce dossier (pour « Depuis les discussions »).
  const available = useMemo<Resource[]>(() => {
    const fileIds = new Set(folder.files.map((f) => f.id));
    const urls = new Set(folder.links.map((l) => l.url));
    return [...shared.files.filter((f) => !fileIds.has(f.id)), ...shared.links.filter((l) => !urls.has(l.url))].sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt),
    );
  }, [shared, folder.files, folder.links]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menuOpen]);

  /** Importe des fichiers directement dans le dossier (par lots de 10). */
  async function uploadFiles(list: FileList | File[]) {
    const files = Array.from(list);
    const problems = files.map(checkFile).filter(Boolean) as string[];
    const valid = files.filter((f) => !checkFile(f));
    setError(problems.length ? problems.join(" ") : null);
    if (valid.length === 0) return;

    setUploading(valid.length);
    try {
      for (let i = 0; i < valid.length; i += MAX_FILES_PER_MESSAGE) {
        const form = new FormData();
        form.append("folderId", folder.id);
        form.append("space", space);
        valid.slice(i, i + MAX_FILES_PER_MESSAGE).forEach((f) => form.append("files", f));
        const res = await fetch("/api/fichiers", { method: "POST", body: form });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error ?? "Import impossible.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import impossible.");
    } finally {
      setUploading(0);
      router.refresh();
    }
  }

  function remove(r: Resource) {
    if (!r.itemId) return;
    setError(null);
    startTransition(async () => {
      const res = await removeFolderItem(space, r.itemId!);
      if (!res.ok) setError(res.error);
    });
  }

  function saveName(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await renameFolder(space, folder.id, nameDraft);
      if (res.ok) setRenaming(false);
      else setError(res.error);
    });
  }

  const hasFilesDrag = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  const menuItem = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-surface-2";

  return (
    <div
      className="relative h-full"
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
        void uploadFiles(e.dataTransfer.files);
      }}
    >
      {dragOver && (
        <div className="pointer-events-none absolute inset-3 z-30 flex flex-col items-center justify-center gap-3 rounded-[24px] border-2 border-dashed border-accent bg-surface/90 text-accent-strong">
          <Upload className="size-8" />
          <p className="font-medium">Déposez vos fichiers dans « {folder.name} »</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT_ALL}
        hidden
        onChange={(e) => {
          if (e.target.files) void uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="scroll-thin h-full overflow-y-auto">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
          <Breadcrumb current={folder.name} basePath={basePath} />

          <header className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2/70 text-muted">
                <Folder className="size-6" />
              </span>
              {renaming ? (
                <form onSubmit={saveName} className="flex items-center gap-2">
                  <label htmlFor="folder-name" className="sr-only">
                    Nom du dossier
                  </label>
                  <input
                    id="folder-name"
                    autoFocus
                    value={nameDraft}
                    maxLength={80}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Escape" && (setRenaming(false), setNameDraft(folder.name))}
                    className="w-64 rounded-xl border border-border bg-surface-2/50 px-3 py-2 text-lg font-semibold focus:border-foreground/20 focus:outline-none"
                  />
                  <button type="submit" aria-label="Enregistrer le nom" className="inline-flex size-10 items-center justify-center rounded-xl bg-accent text-background hover:bg-accent-strong">
                    <Check className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => (setRenaming(false), setNameDraft(folder.name))}
                    aria-label="Annuler"
                    className="inline-flex size-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </form>
              ) : (
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="truncate text-[26px] leading-tight font-semibold tracking-tight">{folder.name}</h1>
                    <button
                      type="button"
                      onClick={() => setRenaming(true)}
                      aria-label="Renommer le dossier"
                      title="Renommer"
                      className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
                    >
                      <Pencil className="size-4" />
                    </button>
                  </div>
                  <p className="text-sm text-muted">
                    {items.length} élément{items.length > 1 ? "s" : ""}
                    {space === "user" && " · privés par défaut, cliquez sur « Privé » pour autoriser l'administration"}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  className="inline-flex items-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-background shadow-lg shadow-accent/20 transition hover:bg-accent-strong"
                >
                  <Plus className="size-4" /> Ajouter <ChevronDown className="size-4" />
                </button>
                {menuOpen && (
                  <div role="menu" className="absolute top-full right-0 z-20 mt-2 w-64 rounded-2xl border border-border bg-surface p-1.5 shadow-2xl shadow-black/60">
                    <button type="button" role="menuitem" className={menuItem} onClick={() => (setMenuOpen(false), fileInputRef.current?.click())}>
                      <Upload className="size-[18px] text-accent-strong" />
                      <span>
                        <span className="block">Importer des fichiers</span>
                        <span className="block text-xs text-muted">Photos, vidéos, documents…</span>
                      </span>
                    </button>
                    <button type="button" role="menuitem" className={menuItem} onClick={() => (setMenuOpen(false), linkDialog.current?.showModal())}>
                      <Link2 className="size-[18px] text-accent-strong" /> Ajouter un lien
                    </button>
                    <button type="button" role="menuitem" className={menuItem} onClick={() => (setMenuOpen(false), pickerDialog.current?.showModal())}>
                      <MessageSquareText className="size-[18px] text-accent-strong" />
                      <span>
                        <span className="block">Depuis les discussions</span>
                        <span className="block text-xs text-muted">Fichiers et liens déjà partagés</span>
                      </span>
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => deleteDialog.current?.showModal()}
                aria-label="Supprimer le dossier"
                title="Supprimer le dossier"
                className="inline-flex size-[46px] items-center justify-center rounded-2xl border border-border text-muted transition-colors hover:border-rose-400/60 hover:bg-rose-500/10 hover:text-rose-300"
              >
                <Trash2 className="size-[18px]" />
              </button>
            </div>
          </header>

          {(uploading > 0 || error) && (
            <div className="mt-4" aria-live="polite">
              {uploading > 0 && (
                <p className="inline-flex items-center gap-2 text-sm text-accent-strong">
                  <Loader2 className="size-4 animate-spin" /> Import de {uploading} fichier{uploading > 1 ? "s" : ""}…
                </p>
              )}
              {error && (
                <p role="alert" className="text-sm text-rose-300">
                  {error}
                </p>
              )}
            </div>
          )}

          <div className="mt-8">
            {items.length === 0 ? (
              <Empty
                label="Ce dossier est vide."
                hint="Utilisez « Ajouter » pour importer des fichiers, ajouter un lien ou reprendre des ressources des discussions. Vous pouvez aussi glisser-déposer des fichiers ici."
              />
            ) : (
              <ResourceSections
                items={items}
                onRemove={remove}
                onShare={users ? openShare : space === "user" ? toggleAdminAccess : undefined}
                shareMode={users ? "users" : "admin"}
              />
            )}
          </div>
        </div>
      </div>

      <LinkDialog dialogRef={linkDialog} folderId={folder.id} space={space} />
      <PickerDialog dialogRef={pickerDialog} folderId={folder.id} available={available} space={space} />
      <DeleteDialog dialogRef={deleteDialog} folderId={folder.id} name={folder.name} space={space} />
      {users && (
        <ShareDialog
          dialogRef={shareDialog}
          item={items.find((r) => r.itemId === shareItemId) ?? null}
          users={users}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Modal({
  dialogRef,
  title,
  width = 440,
  children,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  title: string;
  width?: number;
  children: ReactNode;
}) {
  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}
      style={{ width: `min(94vw, ${width}px)` }}
      className="m-auto rounded-[24px] border border-border bg-surface p-0 text-foreground shadow-2xl shadow-black/60 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex max-h-[min(760px,88vh)] flex-col">
        <div className="flex items-center gap-2 border-b border-border/60 px-6 py-5">
          <h2 className="mr-auto text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Fermer"
            className="inline-flex size-9 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <X className="size-[18px]" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

const primaryButton =
  "inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-surface-2";
const inputClass =
  "w-full rounded-xl border border-border bg-surface-2/50 px-3.5 py-2.5 text-sm placeholder:text-muted/70 focus:border-foreground/20 focus:outline-none";

function LinkDialog({
  dialogRef,
  folderId,
  space,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  folderId: string;
  space: Space;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addLinkToFolder(space, folderId, url, title);
      if (!res.ok) return setError(res.error);
      setUrl("");
      setTitle("");
      dialogRef.current?.close();
    });
  }

  return (
    <Modal dialogRef={dialogRef} title="Ajouter un lien">
      <form onSubmit={submit} className="space-y-4 px-6 py-5">
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">Adresse</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            inputMode="url"
            spellCheck={false}
            placeholder="https://…"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">Titre (facultatif)</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Ex. Maquette Figma"
            className={inputClass}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-rose-300">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={() => dialogRef.current?.close()} className={secondaryButton}>
            Annuler
          </button>
          <button type="submit" disabled={!url.trim() || pending} className={primaryButton}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
            Ajouter
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Choix multiple parmi les ressources déjà partagées dans les discussions. */
function PickerDialog({
  dialogRef,
  folderId,
  available,
  space,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  folderId: string;
  available: Resource[];
  space: Space;
}) {
  const [kind, setKind] = useState<ResourceKind | "tous">("tous");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const q = search.trim().toLocaleLowerCase("fr");

  const visible = available.filter(
    (r) => (kind === "tous" || r.kind === kind) && (!q || resourceSearchText(r).includes(q)),
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function add() {
    const chosen = available.filter((r) => selected.has(r.id));
    const attachmentIds = chosen.filter((r) => r.kind !== "lien").map((r) => r.id);
    const links = chosen
      .filter((r): r is LinkResource => r.kind === "lien" && !!r.messageId)
      .map((l) => ({ url: l.url, messageId: l.messageId! }));
    setError(null);
    startTransition(async () => {
      const res = await addSharedToFolder(space, folderId, attachmentIds, links);
      if (!res.ok) return setError(res.error);
      setSelected(new Set());
      dialogRef.current?.close();
    });
  }

  return (
    <Modal dialogRef={dialogRef} title="Ajouter depuis les discussions" width={620}>
      <div className="space-y-3 border-b border-border/60 px-6 py-4">
        <label className="relative block">
          <span className="sr-only">Rechercher</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, lien, personne, projet…"
            className={`${inputClass} rounded-2xl pl-11`}
          />
        </label>
        <div role="group" aria-label="Type" className="flex flex-wrap gap-1.5">
          {[{ kind: "tous" as const, label: "Tous" }, ...TYPE_FOLDERS].map((t) => (
            <button
              key={t.kind}
              type="button"
              onClick={() => setKind(t.kind)}
              aria-pressed={kind === t.kind}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                kind === t.kind ? "bg-accent text-background" : "bg-surface-2/60 text-muted hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="scroll-thin flex-1 space-y-0.5 overflow-y-auto px-4 py-3">
        {visible.length === 0 && (
          <li className="px-2 py-10 text-center text-sm text-muted">
            {available.length === 0 ? "Tout ce qui a été partagé est déjà dans ce dossier." : "Aucun élément trouvé."}
          </li>
        )}
        {visible.map((r) => {
          const checked = selected.has(r.id);
          const isLink = r.kind === "lien";
          const Icon = isLink ? Globe : documentIcon(r.mimeType);
          return (
            <li key={r.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggle(r.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${
                  checked ? "bg-surface-2" : "hover:bg-surface-2/50"
                }`}
              >
                {r.kind === "photo" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- vignette d'un fichier privé
                  <img src={attachmentUrl(r.id)} alt="" loading="lazy" className="size-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2/70 text-muted">
                    <Icon className="size-[18px]" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{isLink ? r.host : r.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {senderLabel(r.sender)}
                    {r.source ? ` · ${r.source.label}` : ""}
                  </span>
                </span>
                <span
                  aria-hidden
                  className={`inline-flex size-5 shrink-0 items-center justify-center rounded-md border ${
                    checked ? "border-accent bg-accent text-background" : "border-border"
                  }`}
                >
                  {checked && <Check className="size-3.5" strokeWidth={3} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-border/60 px-6 py-4">
        {error && (
          <p role="alert" className="mb-3 text-sm text-rose-300">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => dialogRef.current?.close()} className={secondaryButton}>
            Fermer
          </button>
          <button type="button" onClick={add} disabled={selected.size === 0 || pending} className={primaryButton}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Ajouter{selected.size > 0 ? ` (${selected.size})` : ""}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteDialog({
  dialogRef,
  folderId,
  name,
  space,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  folderId: string;
  name: string;
  space: Space;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await deleteFolder(space, folderId);
      if (!res.ok) return setError(res.error);
      dialogRef.current?.close();
      router.push(`/${space}/ressources`);
    });
  }

  return (
    <Modal dialogRef={dialogRef} title="Supprimer le dossier">
      <div className="px-6 py-5">
        <p className="text-sm leading-relaxed text-muted">
          Le dossier <span className="font-semibold text-foreground">« {name} »</span> sera supprimé. Les fichiers
          importés directement dans ce dossier seront supprimés définitivement ; les fichiers et liens partagés dans
          les discussions y restent.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-300">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => dialogRef.current?.close()} className={secondaryButton}>
            Annuler
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Supprimer
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Choix des utilisateurs autorisés à consulter un élément du dossier. */
function ShareDialog({
  dialogRef,
  item,
  users,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  item: Resource | null;
  users: AccessUser[];
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Repart de zéro à chaque changement d'élément.
  useEffect(() => {
    setSearch("");
    setSelected(new Set());
    setError(null);
  }, [item?.itemId]);

  const access = item?.access ?? [];
  const accessIds = new Set(access.map((u) => u.id));
  const q = search.trim().toLocaleLowerCase("fr");
  const candidates = users.filter(
    (u) =>
      !accessIds.has(u.id) &&
      (!q || [u.name, u.company ?? ""].join(" ").toLocaleLowerCase("fr").includes(q)),
  );
  const itemName = item ? (item.kind === "lien" ? item.title || item.host : item.name) : "";

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function grant() {
    if (!item?.itemId) return;
    setError(null);
    startTransition(async () => {
      const res = await grantItemAccess(item.itemId!, [...selected]);
      if (res.ok) setSelected(new Set());
      else setError(res.error);
    });
  }

  function revoke(userId: string) {
    if (!item?.itemId) return;
    setError(null);
    startTransition(async () => {
      const res = await revokeItemAccess(item.itemId!, userId);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <Modal dialogRef={dialogRef} title="Gérer l'accès" width={500}>
      <div className="scroll-thin flex-1 overflow-y-auto px-6 py-4">
        <p className="text-sm text-muted">
          Choisissez qui peut consulter <span className="font-medium text-foreground">« {itemName} »</span>.
        </p>

        {/* Personnes ayant accès */}
        <p className="mt-5 text-xs font-medium tracking-wide text-muted uppercase">Ont accès ({access.length + 1})</p>
        <ul className="mt-2 space-y-1">
          <li className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm text-muted">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-foreground">
              Vous
            </span>
            Administrateur · accès complet
          </li>
          {access.map((u) => (
            <li key={u.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
              <Avatar name={displayName(u)} status={u.status} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{displayName(u)}</span>
                <span className="block text-xs text-muted">{ROLE_LABELS[u.role]}</span>
              </span>
              <button
                type="button"
                onClick={() => revoke(u.id)}
                disabled={pending}
                aria-label={`Retirer l'accès de ${displayName(u)}`}
                title="Retirer l'accès"
                className="inline-flex size-9 items-center justify-center rounded-xl text-muted hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
              >
                <UserMinus className="size-4" />
              </button>
            </li>
          ))}
        </ul>

        {/* Donner l'accès */}
        <p className="mt-6 text-xs font-medium tracking-wide text-muted uppercase">Donner l&apos;accès</p>
        <label className="relative mt-2 block">
          <span className="sr-only">Rechercher un utilisateur</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom ou entreprise…"
            className={`${inputClass} rounded-2xl pl-11`}
          />
        </label>
        <ul className="mt-2 space-y-0.5">
          {candidates.length === 0 && (
            <li className="px-2 py-6 text-center text-sm text-muted">
              {users.length === access.length ? "Tout le monde a déjà accès." : "Aucun utilisateur trouvé."}
            </li>
          )}
          {candidates.map((u) => {
            const checked = selected.has(u.id);
            return (
              <li key={u.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggle(u.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${
                    checked ? "bg-surface-2" : "hover:bg-surface-2/50"
                  }`}
                >
                  <Avatar name={displayName(u)} status={u.status} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{displayName(u)}</span>
                    <span className="block text-xs text-muted">{ROLE_LABELS[u.role]}</span>
                  </span>
                  <span
                    aria-hidden
                    className={`inline-flex size-5 shrink-0 items-center justify-center rounded-md border ${
                      checked ? "border-accent bg-accent text-background" : "border-border"
                    }`}
                  >
                    {checked && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-t border-border/60 px-6 py-4">
        {error && (
          <p role="alert" className="mb-3 text-sm text-rose-300">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => dialogRef.current?.close()} className={secondaryButton}>
            Fermer
          </button>
          <button type="button" onClick={grant} disabled={selected.size === 0 || pending} className={primaryButton}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Donner l&apos;accès{selected.size > 0 ? ` (${selected.size})` : ""}
          </button>
        </div>
      </div>
    </Modal>
  );
}
