"use client";

import type { Space } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024;

/** Photo de profil de l'admin : changer (envoi immédiat) ou retirer. */
/** `space` : espace de la page (admin ou user), dont le compte reçoit la photo. */
export function AvatarEditor({ name, avatarUrl, space }: { name: string; avatarUrl: string | null; space: Space }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (!ACCEPTED.includes(file.type)) return setError("Format accepté : JPG, PNG, WebP ou GIF.");
    if (file.size > MAX_SIZE) return setError("La photo dépasse 5 Mo.");
    setBusy("upload");
    try {
      const form = new FormData();
      form.append("photo", file);
      form.append("space", space);
      const res = await fetch("/api/avatars", { method: "POST", body: form });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "Envoi de la photo impossible.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi de la photo impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setError(null);
    setBusy("remove");
    try {
      const res = await fetch(`/api/avatars?space=${space}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Impossible de retirer la photo.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de retirer la photo.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
      {/* Socle opaque : l'avatar chevauche la bannière */}
      <div className="relative rounded-full bg-surface p-1.5">
        <Avatar name={name} src={avatarUrl} size="3xl" />
        {busy && (
          <span className="absolute inset-1.5 flex items-center justify-center rounded-full bg-black/55">
            <Loader2 className="size-7 animate-spin text-white" />
          </span>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!!busy}
          aria-label="Changer la photo de profil"
          title="Changer la photo"
          className="absolute right-1 bottom-1 inline-flex size-10 items-center justify-center rounded-full border-4 border-surface bg-surface-2 text-foreground transition-colors hover:bg-accent hover:text-background disabled:opacity-60"
        >
          <Camera className="size-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!!busy}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/30 px-3.5 py-2 text-sm font-medium transition-colors hover:border-foreground/20 disabled:opacity-60"
        >
          <Camera className="size-4" /> {avatarUrl ? "Changer la photo" : "Ajouter une photo"}
        </button>
        {avatarUrl && (
          <button
            type="button"
            onClick={remove}
            disabled={!!busy}
            className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm text-muted transition-colors hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-60"
          >
            <Trash2 className="size-4" /> Retirer
          </button>
        )}
      </div>
      <p className="text-xs text-muted">JPG, PNG, WebP ou GIF · 5 Mo maximum</p>
      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
