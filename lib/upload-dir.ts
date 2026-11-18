import path from "node:path";

/**
 * Dossier des fichiers envoyés (pièces jointes, photos de profil et de couverture).
 * UPLOAD_DIR : chemin absolu conseillé en production, sur un disque persistant de l'hébergeur.
 * Sans import « server-only » : utilisable aussi au démarrage du serveur (instrumentation.ts).
 */
export function uploadDirPath() {
  // turbopackIgnore : dossier de données à l'exécution, à ne pas embarquer dans le build.
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.UPLOAD_DIR || "storage/uploads");
}
