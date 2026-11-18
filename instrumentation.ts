/**
 * Exécuté une fois au démarrage du serveur Next (avant les premières requêtes).
 * Vérifie le dossier des fichiers envoyés sur l'hébergeur (lib/storage-check.ts, propre à Node.js).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { checkStorage } = await import("./lib/storage-check");
    await checkStorage();
  }
}
