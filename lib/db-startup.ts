import { randomBytes, scryptSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

/**
 * Au démarrage du serveur (instrumentation.ts) : applique db/schema.sql (idempotent : ne crée que ce qui manque)
 * et, si ADMIN_EMAIL et ADMIN_PASSWORD sont définis et qu'aucun compte admin n'existe, crée ce compte.
 * Un compte admin existant n'est jamais modifié. N'empêche jamais le démarrage.
 */
export async function prepareDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[base] DATABASE_URL non défini : schéma non vérifié.");
    return;
  }
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
  try {
    await client.connect();
    const sql = await readFile(path.join(/* turbopackIgnore: true */ process.cwd(), "db", "schema.sql"), "utf8");
    await client.query(sql);
    console.log("[base] Schéma de la base à jour.");

    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (email && password) {
      const { rows } = await client.query("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1");
      if (rows.length === 0) {
        // Même format que lib/password.ts : « scrypt:<sel hex>:<empreinte hex> »
        const salt = randomBytes(16);
        const hash = `scrypt:${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
        await client.query(
          "INSERT INTO users (full_name, email, role, password_hash) VALUES ('Admin', $1, 'admin', $2) ON CONFLICT (email) DO NOTHING",
          [email, hash],
        );
        console.log(`[base] Compte administrateur créé : ${email}`);
      }
    }
  } catch (err) {
    console.error("[base] ERREUR lors de la préparation de la base :", err instanceof Error ? err.message : err);
  } finally {
    await client.end().catch(() => {});
  }
}
