import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getActor, isSpace } from "@/lib/auth";
import { query } from "@/lib/db";
import { storagePath, uploadDir } from "@/lib/storage";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** Photo de profil (avatar) ou photo de couverture du profil. */
const KINDS = {
  avatar: { maxSize: 5 * 1024 * 1024, label: "5 Mo", key: "avatar_key", mime: "avatar_mime", updated: "avatar_updated_at" },
  cover: { maxSize: 8 * 1024 * 1024, label: "8 Mo", key: "cover_key", mime: "cover_mime", updated: "cover_updated_at" },
} as const;
type Kind = keyof typeof KINDS;

const kindOf = (value: unknown): Kind => (value === "cover" ? "cover" : "avatar");
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

async function previousKey(userId: string, kind: Kind) {
  const [row] = await query<{ key: string | null }>(`SELECT ${KINDS[kind].key} AS key FROM users WHERE id = $1`, [userId]);
  return row?.key ?? null;
}

/** Les photos apparaissent dans les deux espaces (menu, discussions, profils). */
function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/user", "layout");
}

/**
 * Remplace la photo de profil (`kind=avatar`) ou de couverture (`kind=cover`)
 * du compte de l'espace (`space` : admin ou user).
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Envoi invalide.");
  }
  const space = form.get("space");
  if (!isSpace(space)) return fail("Espace invalide.");
  const me = await getActor(space);
  const kind = kindOf(form.get("kind"));
  const { maxSize, label, key: keyCol, mime: mimeCol, updated } = KINDS[kind];
  const file = form.get("photo");
  if (!(file instanceof File)) return fail("Aucune photo reçue.");
  if (!IMAGE_TYPES.has(file.type)) return fail("Format accepté : JPG, PNG, WebP ou GIF.");
  if (file.size > maxSize) return fail(`La photo dépasse ${label}.`);
  if (file.size === 0) return fail("La photo est vide.");

  await mkdir(uploadDir(), { recursive: true });
  const key = randomUUID();
  await writeFile(storagePath(key), Buffer.from(await file.arrayBuffer()));

  const previous = await previousKey(me.id, kind);
  await query(`UPDATE users SET ${keyCol} = $2, ${mimeCol} = $3, ${updated} = now() WHERE id = $1`, [
    me.id,
    key,
    file.type,
  ]);
  if (previous) await unlink(storagePath(previous)).catch(() => {});

  refresh();
  return NextResponse.json({ ok: true });
}

/** Retire la photo de profil ou de couverture (`?kind=cover`) du compte de l'espace (`?space=`). */
export async function DELETE(request: Request) {
  const params = new URL(request.url).searchParams;
  const space = params.get("space");
  if (!isSpace(space)) return fail("Espace invalide.");
  const me = await getActor(space);
  const kind = kindOf(params.get("kind"));
  const { key: keyCol, mime: mimeCol, updated } = KINDS[kind];
  const previous = await previousKey(me.id, kind);
  await query(`UPDATE users SET ${keyCol} = NULL, ${mimeCol} = NULL, ${updated} = now() WHERE id = $1`, [me.id]);
  if (previous) await unlink(storagePath(previous)).catch(() => {});
  refresh();
  return NextResponse.json({ ok: true });
}
