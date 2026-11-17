import { Pool, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __twinslackPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL manquant : ajoutez-le dans .env.local");
  }
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 15_000,
  });
  // Connexion inactive coupée (redémarrage de PostgreSQL…) : journalisée au lieu d'arrêter le processus
  pool.on("error", (err) => console.error("[pg] connexion inactive perdue :", err.message));
  return pool;
}

// Un seul pool par processus (rechargements à chaud en développement, plusieurs bundles en production).
export const pool = globalThis.__twinslackPool ?? createPool();
globalThis.__twinslackPool = pool;

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []) {
  const result = await pool.query<T>(text, params);
  return result.rows;
}
