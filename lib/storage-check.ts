import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { uploadDirPath } from "./upload-dir";

/**
 * Au démarrage du serveur : crée le dossier des fichiers envoyés s'il manque, vérifie qu'on peut y écrire,
 * et prévient dans les journaux s'il risque d'être effacé à chaque déploiement. N'empêche jamais le démarrage.
 */
export async function checkStorage() {
  const dir = uploadDirPath();

  try {
    await mkdir(dir, { recursive: true });
    // Test d'écriture réel (un dossier peut exister sans être modifiable)
    const probe = path.join(dir, `.test-ecriture-${process.pid}`);
    await writeFile(probe, "ok");
    await unlink(probe);
    console.log(`[stockage] Dossier des fichiers prêt : ${dir}`);
  } catch (err) {
    console.error(
      `[stockage] ERREUR : le dossier des fichiers n'est pas accessible en écriture (${dir}). ` +
        "Les pièces jointes et photos ne pourront pas être enregistrées. " +
        "Vérifiez UPLOAD_DIR et les droits d'écriture du dossier sur l'hébergeur.",
      err instanceof Error ? err.message : err,
    );
  }

  if (process.env.NODE_ENV !== "production") return;
  // Plateformes sans disque permanent : les fichiers disparaissent à chaque déploiement ou redémarrage
  if (process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    console.warn(
      "[stockage] ATTENTION : cet hébergement n'a pas de disque permanent. Les fichiers envoyés seront perdus. " +
        "Utilisez un serveur (VPS) ou un hébergeur avec volume persistant, et définissez UPLOAD_DIR sur ce volume.",
    );
  } else if (!path.isAbsolute(process.env.UPLOAD_DIR || process.env.TWINS_VOLUME_MOUNT_PATH || "")) {
    console.warn(
      `[stockage] Conseil : UPLOAD_DIR n'est pas un chemin absolu (dossier actuel : ${dir}). ` +
        "S'il se trouve dans le dossier de l'application, il peut être effacé lors d'un redéploiement : " +
        "placez-le sur un volume persistant (ex. UPLOAD_DIR=/var/lib/twinschat/uploads).",
    );
  }
}
