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
  return new Pool({ connectionString, max: 10 });
}

// Réutilise le pool entre les rechargements à chaud en développement.
export const pool = globalThis.__twinslackPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalThis.__twinslackPool = pool;

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []) {
  const result = await pool.query<T>(text, params);
  return result.rows;
}
