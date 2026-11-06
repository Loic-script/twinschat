import "server-only";
import path from "node:path";
import { isUuid } from "./messages";

/** Dossier des pièces jointes, hors du dossier public (servi via /api/fichiers/[id]). */
export function uploadDir() {
  // turbopackIgnore : dossier de données à l'exécution, à ne pas embarquer dans le build.
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.UPLOAD_DIR ?? "storage/uploads");
}

/** Chemin sur disque d'une pièce jointe. La clé est un UUID : aucun parcours de dossier possible. */
export function storagePath(key: string) {
  if (!isUuid(key)) throw new Error("Clé de stockage invalide.");
  return path.join(/* turbopackIgnore: true */ uploadDir(), key);
}
