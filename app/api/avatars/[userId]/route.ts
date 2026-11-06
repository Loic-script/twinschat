import { readFile } from "node:fs/promises";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { isUuid } from "@/lib/messages";
import { storagePath } from "@/lib/storage";

const notFound = () => new Response("Photo introuvable.", { status: 404 });

/**
 * Photo de profil d'un utilisateur, ou sa photo de couverture avec `?kind=cover`.
 * L'adresse est versionnée (?v=…) : elle change à chaque nouvelle photo.
 */
export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  if (!isUuid(userId)) return notFound();
  // Photos visibles uniquement dans l'application, par un compte connecté.
  if (!(await getSessionUser())) return new Response("Connexion requise.", { status: 401 });

  const cover = new URL(request.url).searchParams.get("kind") === "cover";
  const [user] = await query<{ key: string | null; mime: string | null }>(
    cover
      ? "SELECT cover_key AS key, cover_mime AS mime FROM users WHERE id = $1"
      : "SELECT avatar_key AS key, avatar_mime AS mime FROM users WHERE id = $1",
    [userId],
  );
  if (!user?.key || !user.mime) return notFound();

  try {
    const data = await readFile(storagePath(user.key));
    return new Response(data, {
      headers: {
        "Content-Type": user.mime,
        "Content-Length": String(data.length),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return notFound();
  }
}
