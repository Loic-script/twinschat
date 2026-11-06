import { config } from "dotenv";
import { randomBytes, scryptSync } from "node:crypto";
import { Client } from "pg";

config({ path: ".env.local" });

/**
 * Identifiants de connexion du compte administrateur, lus dans .env.local :
 * ADMIN_EMAIL (adresse) et ADMIN_PASSWORD (mot de passe, enregistré uniquement sous forme d'empreinte).
 * Met à jour le compte admin existant (ou le crée s'il n'y en a aucun) et ferme ses sessions ouvertes.
 */
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Renseignez ADMIN_EMAIL et ADMIN_PASSWORD dans .env.local.");

  // Même format que lib/password.ts : « scrypt:<sel hex>:<empreinte hex> ».
  const salt = randomBytes(16);
  const hash = `scrypt:${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const taken = await client.query("SELECT 1 FROM users WHERE lower(email) = $1 AND role <> 'admin'", [email]);
    if (taken.rowCount) throw new Error(`L'adresse ${email} appartient déjà à un compte non administrateur.`);

    const { rows } = await client.query<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE role = 'admin'
        ORDER BY (lower(email) = $1) DESC, created_at
        LIMIT 1`,
      [email],
    );
    const admin = rows[0];
    if (admin) {
      await client.query("UPDATE users SET email = $2, password_hash = $3 WHERE id = $1", [admin.id, email, hash]);
      await client.query("DELETE FROM sessions WHERE user_id = $1", [admin.id]);
      console.log(
        admin.email === email
          ? `Compte admin ${email} : mot de passe mis à jour.`
          : `Compte admin : ${admin.email} → ${email}, mot de passe mis à jour.`,
      );
    } else {
      await client.query("INSERT INTO users (full_name, email, role, password_hash) VALUES ('Admin', $1, 'admin', $2)", [email, hash]);
      console.log(`Compte admin ${email} créé.`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
