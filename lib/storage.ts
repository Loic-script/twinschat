import "server-only";
import path from "node:path";
import { isUuid } from "./messages";
import { uploadDirPath } from "./upload-dir";

/** Dossier des pièces jointes, hors du dossier public (servi via /api/fichiers/[id]). */
export function uploadDir() {
  return uploadDirPath();
}

/** Chemin sur disque d'une pièce jointe. La clé est un UUID : aucun parcours de dossier possible. */
export function storagePath(key: string) {
  if (!isUuid(key)) throw new Error("Clé de stockage invalide.");
  return path.join(/* turbopackIgnore: true */ uploadDir(), key);
}
