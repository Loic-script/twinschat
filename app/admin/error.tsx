"use client";

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-lg font-semibold">Une erreur est survenue</h1>
      <p className="max-w-md text-sm text-muted">{error.message || "Impossible de charger cette page."}</p>
      <button type="button" onClick={reset} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-strong">
        Réessayer
      </button>
    </div>
  );
}
