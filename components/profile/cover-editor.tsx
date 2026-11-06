"use client";

import type { Space } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 8 * 1024 * 1024;

/** Photo de couverture du profil (bannière), modifiable directement dessus. */
/** `space` : espace de la page (admin ou user), dont le compte reçoit la couverture. */
export function CoverEditor({ coverUrl, space }: { coverUrl: string | null; space: Space }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(request: Promise<Response>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await request;
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? fallback);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  function upload(file: File) {
    if (!ACCEPTED.includes(file.type)) return setError("Format accepté : JPG, PNG, WebP ou GIF.");
    if (file.size > MAX_SIZE) return setError("La photo dépasse 8 Mo.");
    const form = new FormData();
    form.append("kind", "cover");
    form.append("photo", file);
    form.append("space", space);
    void send(fetch("/api/avatars", { method: "POST", body: form }), "Envoi de la couverture impossible.");
  }

  const overlayButton =
    "inline-flex items-center gap-2 rounded-xl bg-black/55 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/75 disabled:opacity-60";

  return (
    <div className="relative h-36 overflow-hidden md:h-48">
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- photo privée servie par l'API
        <img src={coverUrl} alt="" className="size-full object-cover" />
      ) : (
        <div className="relative size-full bg-gradient-to-br from-accent-strong/70 via-accent/40 to-emerald-900/40">
          <span
            aria-hidden
            className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle,rgba(255,255,255,.6)_1px,transparent_1.5px)] [background-size:22px_22px] [mask-image:linear-gradient(to_left,black,transparent_80%)]"
          />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />
      <div className="absolute top-3 right-3 flex gap-2">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className={overlayButton}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          {coverUrl ? "Changer la couverture" : "Ajouter une couverture"}
        </button>
        {coverUrl && (
          <button
            type="button"
            onClick={() => void send(fetch(`/api/avatars?kind=cover&space=${space}`, { method: "DELETE" }), "Impossible de retirer la couverture.")}
            disabled={busy}
            aria-label="Retirer la photo de couverture"
            title="Retirer la couverture"
            className={`${overlayButton} px-2.5`}
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="absolute bottom-3 left-3 rounded-lg bg-black/70 px-3 py-1.5 text-sm text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
