import { config } from "dotenv";
import { Client } from "pg";
import { seedProfiles } from "./lib/profiles";

config({ path: ".env.local" });

/** Ajoute les profils et projets de démo sans toucher aux messages existants. */
async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("BEGIN");
  try {
    const result = await seedProfiles(client);
    await client.query("COMMIT");
    console.log(`${result.profiles} profils à jour, ${result.createdProjects} projets et ${result.createdThreads} discussions de projet et ${result.createdFiles} fichiers de démo créés.`);
    console.log(`${result.passwords} compte(s) ont reçu le mot de passe de démo (DEMO_PASSWORD, voir scripts/lib/profiles.ts).`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
