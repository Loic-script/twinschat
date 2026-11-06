"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/ui/avatar";
import { displayName, formatPresence, ROLE_LABELS } from "@/lib/format";
import type { Participant } from "@/lib/projects";

/**
 * « N participants » dans l'en-tête d'une discussion de projet : avatars empilés,
 * et au clic la liste des membres (lecture seule ; l'ajout se fait avec « + »).
 */
export function ParticipantsSummary({
  members,
  ownerId,
  adminName,
  adminAvatarUrl = null,
  viewerId,
}: {
  /** Membres hors admin. */
  members: Participant[];
  ownerId: string;
  adminName: string;
  adminAvatarUrl?: string | null;
  /**
   * Espace utilisateur : le compte qui consulte (affiché « Vous »). Sans lien vers les
   * profils, réservés à l'admin. Absent dans l'espace admin (l'admin est alors « Vous »).
   */
  viewerId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const total = members.length + 1; // + l'admin

  // L'auteur en premier, puis les autres membres.
  const ordered = [...members].sort((a, b) => Number(b.id === ownerId) - Number(a.id === ownerId));

  function toggle() {
    if (open) return setOpen(false);
    const r = buttonRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 8, left: Math.min(r.left, window.innerWidth - 336) });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-2 rounded-md align-middle hover:text-foreground"
      >
        <span className="flex -space-x-2" aria-hidden>
          {ordered.slice(0, 3).map((m) => (
            <span key={m.id} className="rounded-full ring-2 ring-surface">
              <Avatar name={displayName(m)} size="xs" />
            </span>
          ))}
        </span>
        <span className="underline-offset-2 hover:underline">
          {total} participant{total > 1 ? "s" : ""}
        </span>
      </button>

      {/* Rendu dans <body> : le sous-titre est un <p>, qui ne peut pas contenir de liste. */}
      {open && pos && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Membres de la discussion"
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 w-80 overflow-hidden rounded-2xl border border-border bg-surface text-left shadow-2xl shadow-black/60"
        >
          <div className="border-b border-border/60 px-4 py-3 text-sm font-semibold text-foreground">
            Membres de la discussion ({total})
          </div>
          <ul className="scroll-thin max-h-80 overflow-y-auto p-2">
            <li className="flex items-center gap-3 rounded-xl px-2 py-2">
              <Avatar name={adminName} src={adminAvatarUrl} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{adminName}</span>
                <span className="block text-xs text-muted">{viewerId ? "Administrateur" : "Vous · Administrateur"}</span>
              </span>
            </li>
            {ordered.map((m) => {
              const content = (
                <>
                  <Avatar name={displayName(m)} status={m.status} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{displayName(m)}</span>
                    <span className="block truncate text-xs text-muted" suppressHydrationWarning>
                      {m.id === viewerId && "Vous · "}
                      {m.id === ownerId ? "Auteur du projet" : ROLE_LABELS[m.role]}
                      {m.id !== viewerId && <> · {formatPresence(m.status, null)}</>}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={m.id}>
                  {viewerId ? (
                    <div className="flex items-center gap-3 rounded-xl px-2 py-2">{content}</div>
                  ) : (
                    <Link
                      href={`/admin/utilisateurs/${m.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2/70"
                    >
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>,
        document.body,
      )}
    </>
  );
}
