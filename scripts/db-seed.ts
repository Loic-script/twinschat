import { config } from "dotenv";
import { Client } from "pg";
import { seedProfiles } from "./lib/profiles";

config({ path: ".env.local" });

type Role = "admin" | "utilisateur" | "client" | "entreprise";
type Status = "en_ligne" | "absent" | "hors_ligne";

const people: { name: string; email: string; role: Role; company?: string; status: Status }[] = [
  { name: "Elanor Rakoto", email: "elanor@example.com", role: "client", status: "en_ligne" },
  { name: "Alvin Randria", email: "alvin@example.com", role: "utilisateur", status: "en_ligne" },
  { name: "Summer Andry", email: "summer@example.com", role: "client", status: "absent" },
  { name: "Greg Rasoa", email: "greg@agence-nova.example", role: "entreprise", company: "Agence Nova", status: "hors_ligne" },
  { name: "Walt Rabe", email: "walt@example.com", role: "utilisateur", status: "hors_ligne" },
  { name: "Josie Haja", email: "josie@madalogistique.example", role: "entreprise", company: "Mada Logistique", status: "en_ligne" },
  { name: "Tiana Ravelo", email: "tiana@example.com", role: "client", status: "hors_ligne" },
];

// [offset en minutes depuis maintenant (négatif = passé), expéditeur ("admin" | "them"), texte]
type Line = [number, "admin" | "them", string];

const threads: Record<string, Line[]> = {
  "elanor@example.com": [
    [-60 * 26, "them", "Bonjour, je voulais savoir si ma commande est bien partie ?"],
    [-60 * 25.8, "admin", "Bonjour Elanor ! Oui, elle a été expédiée ce matin."],
    [-60 * 25.7, "admin", "Vous recevrez le numéro de suivi par e-mail."],
    [-60 * 2, "them", "Super, merci 🙏"],
    [-60 * 1.9, "them", "Est-ce que vous pouvez m'envoyer la facture d'hier ?"],
    [-60 * 1.5, "admin", "La voici, je vous la joins en PDF."],
    [-12, "them", "Parfait, c'est reçu"],
  ],
  "alvin@example.com": [
    [-60 * 5, "them", "Salut, l'accès à l'espace Ressources ne marche pas chez moi."],
    [-60 * 4.8, "admin", "Je regarde ça. Tu as essayé de te reconnecter ?"],
    [-35, "them", "Oui, toujours la même erreur."],
  ],
  "summer@example.com": [
    [-60 * 30, "admin", "Bonjour Summer, votre rendez-vous est confirmé pour jeudi 10h."],
    [-60 * 29, "them", "Merci beaucoup, à jeudi !"],
  ],
  "greg@agence-nova.example": [
    [-60 * 50, "them", "Bonjour, nous aimerions discuter d'un partenariat."],
    [-60 * 49, "admin", "Avec plaisir. Pouvez-vous m'envoyer votre présentation ?"],
    [-60 * 3, "them", "C'est envoyé par e-mail, dites-moi ce que vous en pensez."],
  ],
  "walt@example.com": [
    [-60 * 72, "them", "Merci pour l'aide de la semaine dernière !"],
  ],
  "josie@madalogistique.example": [
    [-60 * 6, "them", "Les 3 palettes arrivent demain à l'entrepôt."],
    [-60 * 5.9, "admin", "Bien noté, l'équipe sera prête dès 8h."],
    [-8, "them", "Le chauffeur aura 30 min de retard."],
    [-6, "them", "Désolée pour le contretemps."],
  ],
};

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("BEGIN");
  try {
    await client.query("TRUNCATE messages, conversation_members, conversations, users CASCADE");

    const adminEmail = process.env.ADMIN_EMAIL ?? "admin@twinslack.app";
    const { rows: [admin] } = await client.query<{ id: string }>(
      `INSERT INTO users (full_name, email, role, status, last_seen_at)
       VALUES ('Loïc Admin', $1, 'admin', 'en_ligne', now()) RETURNING id`,
      [adminEmail],
    );

    for (const p of people) {
      const { rows: [user] } = await client.query<{ id: string }>(
        `INSERT INTO users (full_name, email, role, company, status, last_seen_at)
         VALUES ($1, $2, $3, $4, $5, now() - interval '1 hour' * random() * 48) RETURNING id`,
        [p.name, p.email, p.role, p.company ?? null, p.status],
      );

      const lines = threads[p.email];
      if (!lines) continue;

      const lastOffset = lines[lines.length - 1][0];
      const { rows: [conv] } = await client.query<{ id: string }>(
        `INSERT INTO conversations (kind, updated_at)
         VALUES ('direct', now() + make_interval(mins => $1)) RETURNING id`,
        [Math.round(lastOffset)],
      );
      // L'admin a tout lu sauf les derniers messages reçus (pour montrer les badges non lus).
      const unreadFrom = lines.findLastIndex(([, who]) => who === "admin");
      const readUntil = unreadFrom >= 0 ? lines[unreadFrom][0] : lines[0][0] - 1;
      await client.query(
        `INSERT INTO conversation_members (conversation_id, user_id, last_read_at) VALUES
         ($1, $2, now() + make_interval(mins => $3)), ($1, $4, now())`,
        [conv.id, admin.id, Math.round(readUntil), user.id],
      );
      for (const [offset, who, body] of lines) {
        await client.query(
          `INSERT INTO messages (conversation_id, sender_id, body, created_at)
           VALUES ($1, $2, $3, now() + make_interval(mins => $4))`,
          [conv.id, who === "admin" ? admin.id : user.id, body, Math.round(offset)],
        );
      }
    }

    await seedProfiles(client);
    await client.query("COMMIT");
    console.log(`Données de démo insérées (${people.length + 1} utilisateurs).`);
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
