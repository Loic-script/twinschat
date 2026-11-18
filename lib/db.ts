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

/**
 * Un seul pool par processus (rechargements à chaud en développement, plusieurs bundles en production),
 * créé à la première requête seulement : la compilation (`next build`) charge tous les modules sans
 * accès à la base ni à DATABASE_URL (hébergeur qui ne fournit les variables qu'au démarrage).
 */
function getPool() {
  return (globalThis.__twinslackPool ??= createPool());
}

/** Pool PostgreSQL (même usage qu'un `Pool` : `pool.connect()`, `pool.query()`…), créé au premier appel. */
export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const real = getPool();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []) {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}
