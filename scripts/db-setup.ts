import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

config({ path: ".env.local" });

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  const dbName = url.pathname.slice(1);

  // 1. Crée la base si elle n'existe pas (connexion à la base "postgres").
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (exists.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    console.log(`Base "${dbName}" créée.`);
  } else {
    console.log(`Base "${dbName}" déjà présente.`);
  }
  await admin.end();

  // 2. Applique le schéma.
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  await client.query(readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8"));
  await client.end();
  console.log("Schéma appliqué.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
