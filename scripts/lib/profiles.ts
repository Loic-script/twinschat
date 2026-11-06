import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Client } from "pg";
import { gradientPng, simplePdf } from "./demo-files";

type Status = "en_ligne" | "absent" | "hors_ligne";
type Role = "utilisateur" | "client" | "entreprise";
type ProjectStatus = "propose" | "en_cours" | "termine";

type Project = {
  title: string;
  category: string;
  description: string;
  status: ProjectStatus;
  /** Proposé il y a N jours. */
  daysAgo: number;
  /** Terminé il y a N jours (si statut « termine »). */
  doneDaysAgo?: number;
};

export type ProfileSeed = {
  name: string;
  email: string;
  role: Role;
  company?: string;
  status: Status;
  jobTitle: string;
  workplace: string;
  address: string;
  city: string;
  description: string;
  /** Dernière connexion il y a N heures. */
  seenHoursAgo: number;
  projects: Project[];
};

// Données fictives de démonstration.
export const PROFILES: ProfileSeed[] = [
  {
    name: "Elanor Rakoto", email: "elanor@example.com", role: "client", status: "en_ligne",
    jobTitle: "Gérante de boutique", workplace: "Boutique Lova", city: "Antananarivo",
    address: "Lot II M 45, Analakely, Antananarivo 101",
    description: "Je gère une boutique de prêt-à-porter et je souhaite développer la vente en ligne avec livraison sur Tana.",
    seenHoursAgo: 0,
    projects: [
      { title: "Boutique en ligne Lova", category: "Site e-commerce", status: "en_cours", daysAgo: 40,
        description: "Catalogue de 300 articles, paiement Mobile Money et suivi des livraisons." },
      { title: "Charte graphique", category: "Design", status: "termine", daysAgo: 120, doneDaysAgo: 75,
        description: "Logo, palette de couleurs et modèles pour les réseaux sociaux." },
    ],
  },
  {
    name: "Alvin Randria", email: "alvin@example.com", role: "utilisateur", status: "en_ligne",
    jobTitle: "Développeur web", workplace: "Indépendant", city: "Antsirabe",
    address: "Rue Jean Ralaimongo, Antsirabe 110",
    description: "Développeur full-stack JavaScript. Je propose mes services aux PME et je cherche des projets à long terme.",
    seenHoursAgo: 1,
    projects: [
      { title: "Application de réservation", category: "Application web", status: "propose", daysAgo: 6,
        description: "Réservation de chambres d'hôtes avec calendrier partagé et rappels SMS." },
    ],
  },
  {
    name: "Summer Andry", email: "summer@example.com", role: "client", status: "absent",
    jobTitle: "Responsable marketing", workplace: "Cabinet Andry & Fils", city: "Toamasina",
    address: "Boulevard Joffre, Toamasina 501",
    description: "Nous cherchons à moderniser la communication du cabinet et à automatiser la prise de rendez-vous.",
    seenHoursAgo: 5,
    projects: [
      { title: "Prise de rendez-vous en ligne", category: "Application web", status: "termine", daysAgo: 90, doneDaysAgo: 20,
        description: "Agenda en ligne relié à Google Agenda avec confirmation par e-mail." },
      { title: "Newsletter mensuelle", category: "Marketing", status: "propose", daysAgo: 3,
        description: "Mise en place d'une newsletter et d'une base de contacts clients." },
    ],
  },
  {
    name: "Greg Rasoa", email: "greg@agence-nova.example", role: "entreprise", company: "Agence Nova", status: "hors_ligne",
    jobTitle: "Directeur général", workplace: "Agence Nova", city: "Antananarivo",
    address: "Immeuble Fitaratra, Ankorondrano, Antananarivo 101",
    description: "Agence de communication de 25 personnes. Nous cherchons des partenaires techniques pour nos clients.",
    seenHoursAgo: 26,
    projects: [
      { title: "Plateforme de partenariat", category: "Partenariat", status: "propose", daysAgo: 2,
        description: "Mutualiser les développements web de l'agence avec une équipe dédiée." },
      { title: "Site vitrine Agence Nova", category: "Site web", status: "termine", daysAgo: 200, doneDaysAgo: 150,
        description: "Refonte complète du site avec portfolio et blog." },
      { title: "Tableau de bord clients", category: "Application web", status: "en_cours", daysAgo: 30,
        description: "Suivi des campagnes et des budgets pour les clients de l'agence." },
    ],
  },
  {
    name: "Walt Rabe", email: "walt@example.com", role: "utilisateur", status: "hors_ligne",
    jobTitle: "Photographe", workplace: "Studio Rabe", city: "Fianarantsoa",
    address: "Rue Rainandriamampandry, Fianarantsoa 301",
    description: "Photographe de mariage et d'événements. Je voudrais un portfolio en ligne simple à mettre à jour.",
    seenHoursAgo: 70,
    projects: [
      { title: "Portfolio photo", category: "Site web", status: "termine", daysAgo: 60, doneDaysAgo: 10,
        description: "Galeries par événement et formulaire de devis." },
    ],
  },
  {
    name: "Josie Haja", email: "josie@madalogistique.example", role: "entreprise", company: "Mada Logistique", status: "en_ligne",
    jobTitle: "Responsable des opérations", workplace: "Mada Logistique", city: "Toamasina",
    address: "Zone portuaire, Toamasina 501",
    description: "Transport et entreposage entre Toamasina et Antananarivo. Besoin d'outils de suivi des palettes.",
    seenHoursAgo: 0,
    projects: [
      { title: "Suivi des palettes", category: "Logistique", status: "en_cours", daysAgo: 25,
        description: "Scan QR des palettes, historique des mouvements et alertes de retard." },
      { title: "Portail transporteurs", category: "Application web", status: "propose", daysAgo: 1,
        description: "Espace où les chauffeurs déclarent leurs créneaux et incidents." },
    ],
  },
  {
    name: "Tiana Ravelo", email: "tiana@example.com", role: "client", status: "hors_ligne",
    jobTitle: "Fondatrice", workplace: "Ravelo Bio", city: "Antananarivo",
    address: "Ambohijatovo, Antananarivo 101",
    description: "Productrice de cosmétiques naturels. Je souhaite vendre mes produits à l'export.",
    seenHoursAgo: 48,
    projects: [
      { title: "Catalogue export", category: "Site e-commerce", status: "propose", daysAgo: 12,
        description: "Catalogue bilingue français/anglais avec demande de devis pour les grossistes." },
    ],
  },
  {
    name: "Hery Andriamanana", email: "hery@tsarabe.example", role: "entreprise", company: "Tsarabe Immobilier", status: "en_ligne",
    jobTitle: "Gérant", workplace: "Tsarabe Immobilier", city: "Antananarivo",
    address: "Route des Hydrocarbures, Ankorondrano, Antananarivo 101",
    description: "Agence immobilière spécialisée dans la location meublée et la gestion locative.",
    seenHoursAgo: 0,
    projects: [
      { title: "Annonces immobilières", category: "Site web", status: "en_cours", daysAgo: 18,
        description: "Moteur de recherche d'annonces avec carte et visite virtuelle." },
      { title: "Gestion des loyers", category: "Application web", status: "termine", daysAgo: 300, doneDaysAgo: 240,
        description: "Quittances automatiques et suivi des impayés." },
    ],
  },
  {
    name: "Fanja Rasolofo", email: "fanja@example.com", role: "utilisateur", status: "absent",
    jobTitle: "Designer UI/UX", workplace: "Studio Kanto", city: "Mahajanga",
    address: "Avenue de France, Mahajanga 401",
    description: "Designer d'interfaces mobiles. Disponible pour des missions de conception et de prototypage.",
    seenHoursAgo: 3,
    projects: [
      { title: "Application de covoiturage", category: "Application mobile", status: "propose", daysAgo: 4,
        description: "Prototype Figma et tests utilisateurs pour un covoiturage urbain." },
    ],
  },
  {
    name: "Mamy Rakotobe", email: "mamy@example.com", role: "client", status: "hors_ligne",
    jobTitle: "Restaurateur", workplace: "Restaurant Le Baobab", city: "Nosy Be",
    address: "Rue principale, Hell-Ville, Nosy Be 207",
    description: "Restaurant de 60 couverts face à la mer. Je veux proposer la réservation et la commande à emporter.",
    seenHoursAgo: 30,
    projects: [
      { title: "Commande à emporter", category: "Application web", status: "en_cours", daysAgo: 15,
        description: "Menu en ligne, commande et paiement à la récupération." },
      { title: "Menu QR code", category: "Design", status: "termine", daysAgo: 80, doneDaysAgo: 70,
        description: "Menu consultable sur téléphone depuis chaque table." },
    ],
  },
  {
    name: "Voahirana Rabary", email: "voahirana@ecole-avotra.example", role: "entreprise", company: "École Avotra", status: "hors_ligne",
    jobTitle: "Directrice", workplace: "École Avotra", city: "Antsirabe",
    address: "Avenue de l'Indépendance, Antsirabe 110",
    description: "École privée de 400 élèves. Nous voulons faciliter la communication avec les parents.",
    seenHoursAgo: 96,
    projects: [
      { title: "Espace parents", category: "Application web", status: "propose", daysAgo: 9,
        description: "Bulletins, absences et messagerie entre enseignants et parents." },
    ],
  },
  {
    name: "Toky Ramanantsoa", email: "toky@example.com", role: "utilisateur", status: "en_ligne",
    jobTitle: "Data analyste", workplace: "Banque Fanilo", city: "Antananarivo",
    address: "Antaninarenina, Antananarivo 101",
    description: "Analyste de données. Je propose des tableaux de bord pour aider les PME à piloter leur activité.",
    seenHoursAgo: 0,
    projects: [
      { title: "Tableaux de bord PME", category: "Data", status: "en_cours", daysAgo: 22,
        description: "Indicateurs de ventes et de trésorerie mis à jour automatiquement." },
      { title: "Formation Excel avancé", category: "Formation", status: "termine", daysAgo: 150, doneDaysAgo: 120,
        description: "Six sessions pour les équipes comptables." },
    ],
  },
  {
    name: "Nirina Rajaonarison", email: "nirina@vanilla-sava.example", role: "entreprise", company: "Vanilla SAVA", status: "absent",
    jobTitle: "Responsable export", workplace: "Vanilla SAVA", city: "Sambava",
    address: "Route de l'aéroport, Sambava 208",
    description: "Exportateur de vanille. Nous voulons tracer chaque lot du producteur jusqu'au client.",
    seenHoursAgo: 8,
    projects: [
      { title: "Traçabilité des lots", category: "Logistique", status: "propose", daysAgo: 5,
        description: "Fiche par lot avec origine, séchage, qualité et expédition." },
    ],
  },
  {
    name: "Rado Rakotomalala", email: "rado@example.com", role: "client", status: "hors_ligne",
    jobTitle: "Coach sportif", workplace: "Fit Tana", city: "Antananarivo",
    address: "Ivandry, Antananarivo 101",
    description: "Salle de sport et coaching personnalisé. Je veux gérer les abonnements en ligne.",
    seenHoursAgo: 52,
    projects: [
      { title: "Gestion des abonnements", category: "Application web", status: "termine", daysAgo: 100, doneDaysAgo: 30,
        description: "Abonnements, planning des cours et rappels de paiement." },
    ],
  },
  {
    name: "Lalao Randrianarisoa", email: "lalao@example.com", role: "utilisateur", status: "hors_ligne",
    jobTitle: "Rédactrice", workplace: "Indépendante", city: "Toliara",
    address: "Quartier Besakoa, Toliara 601",
    description: "Rédactrice web et traductrice français/anglais/malgache.",
    seenHoursAgo: 120,
    projects: [
      { title: "Blog tourisme du Sud", category: "Contenu", status: "propose", daysAgo: 14,
        description: "Articles et guides sur les destinations du sud de Madagascar." },
    ],
  },
];

/**
 * Ajoute ou complète les profils et leurs projets.
 * N'efface rien : les utilisateurs existants sont mis à jour, les projets ne sont
 * créés que pour les utilisateurs qui n'en ont pas encore.
 */
export async function seedProfiles(client: Client) {
  let createdProjects = 0;
  for (const p of PROFILES) {
    const { rows: [user] } = await client.query<{ id: string }>(
      `INSERT INTO users (full_name, email, role, company, status, last_seen_at,
                          job_title, workplace, address, city, description)
       VALUES ($1, $2, $3, $4, $5, now() - make_interval(hours => $6), $7, $8, $9, $10, $11)
       ON CONFLICT (email) DO UPDATE SET
         company = EXCLUDED.company, job_title = EXCLUDED.job_title,
         workplace = EXCLUDED.workplace, address = EXCLUDED.address,
         city = EXCLUDED.city, description = EXCLUDED.description,
         last_seen_at = COALESCE(users.last_seen_at, EXCLUDED.last_seen_at),
         created_at = LEAST(users.created_at, EXCLUDED.created_at)
       RETURNING id`,
      [p.name, p.email, p.role, p.company ?? null, p.status, p.seenHoursAgo,
       p.jobTitle, p.workplace, p.address, p.city, p.description],
    );
    // Démo réaliste : inscription quelques jours avant le premier projet proposé.
    const signupDaysAgo = Math.max(0, ...p.projects.map((pr) => pr.daysAgo)) + 3;
    await client.query(
      "UPDATE users SET created_at = LEAST(created_at, now() - make_interval(days => $2)) WHERE id = $1",
      [user.id, signupDaysAgo],
    );

    const { rows: [{ count }] } = await client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM projects WHERE owner_id = $1",
      [user.id],
    );
    if (count > 0) continue;

    for (const pr of p.projects) {
      await client.query(
        `INSERT INTO projects (owner_id, title, category, description, status, created_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, now() - make_interval(days => $6),
                 CASE WHEN $7::int IS NULL THEN NULL ELSE now() - make_interval(days => $7::int) END)`,
        [user.id, pr.title, pr.category, pr.description, pr.status, pr.daysAgo, pr.doneDaysAgo ?? null],
      );
      createdProjects++;
    }
  }
  const createdThreads = await seedProjectThreads(client);
  const createdFiles = await seedDemoResources(client);
  const passwords = await seedDemoPasswords(client);
  return { profiles: PROFILES.length, createdProjects, createdThreads, createdFiles, passwords };
}

/**
 * Mot de passe des comptes de démo (admin compris), demandé pour le changer depuis le profil.
 * Remplaçable par la variable DEMO_PASSWORD de .env.local.
 */
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "TwinsDemo2026";

/** Même format que lib/password.ts (« scrypt:<sel hex>:<empreinte hex> »), qui n'est utilisable que côté Next. */
function hashDemoPassword(password: string) {
  const salt = randomBytes(16);
  return `scrypt:${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
}

/** Donne le mot de passe de démo aux comptes qui n'en ont pas encore (jamais d'écrasement). */
export async function seedDemoPasswords(client: Client) {
  const { rows } = await client.query<{ id: string }>("SELECT id FROM users WHERE password_hash IS NULL");
  for (const { id } of rows) {
    await client.query("UPDATE users SET password_hash = $2 WHERE id = $1 AND password_hash IS NULL", [
      id,
      hashDemoPassword(DEMO_PASSWORD),
    ]);
  }
  return rows.length;
}

// Discussions de démo autour de quelques projets : [minutes écoulées, auteur, texte]
type ThreadLine = [number, "admin" | "auteur", string];

const PROJECT_THREADS: { email: string; title: string; lines: ThreadLine[] }[] = [
  {
    email: "elanor@example.com",
    title: "Boutique en ligne Lova",
    lines: [
      [60 * 50, "admin", "Bonjour Elanor, la maquette du catalogue est prête. Vous pouvez la consulter ?"],
      [60 * 48, "auteur", "Oui, j'adore ! Est-ce qu'on peut ajouter un filtre par taille ?"],
      [60 * 47, "admin", "Bien sûr, je l'ajoute pour la prochaine version."],
      [40, "auteur", "Le paiement Mobile Money sera disponible dès le lancement ?"],
    ],
  },
  {
    email: "josie@madalogistique.example",
    title: "Suivi des palettes",
    lines: [
      [60 * 26, "auteur", "Les étiquettes QR sont imprimées, on peut tester demain matin."],
      [60 * 25, "admin", "Parfait, je prépare l'environnement de test."],
      [15, "auteur", "Petit souci : deux palettes ne remontent pas dans l'historique."],
      [12, "auteur", "Je vous envoie les numéros."],
    ],
  },
  {
    email: "greg@agence-nova.example",
    title: "Plateforme de partenariat",
    lines: [
      [60 * 30, "auteur", "Voici le périmètre : 3 sites clients par mois, maintenance comprise."],
      [60 * 29, "admin", "Merci Greg. Je reviens vers vous avec une estimation d'ici vendredi."],
    ],
  },
];

/** Crée les discussions de démo des projets qui n'en ont pas encore. */
export async function seedProjectThreads(client: Client) {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@twinslack.app";
  const { rows: [admin] } = await client.query<{ id: string }>(
    "SELECT id FROM users WHERE email = $1 AND role = 'admin'",
    [adminEmail],
  );
  if (!admin) return 0;

  let created = 0;
  for (const t of PROJECT_THREADS) {
    const { rows: [project] } = await client.query<{ id: string; owner_id: string }>(
      `SELECT p.id, p.owner_id FROM projects p JOIN users u ON u.id = p.owner_id
        WHERE u.email = $1 AND p.title = $2 LIMIT 1`,
      [t.email, t.title],
    );
    if (!project) continue;
    const { rowCount } = await client.query("SELECT 1 FROM conversations WHERE project_id = $1", [project.id]);
    if (rowCount) continue;

    const { rows: [conv] } = await client.query<{ id: string }>(
      "INSERT INTO conversations (kind, project_id) VALUES ('projet', $1) RETURNING id",
      [project.id],
    );
    // L'admin a lu jusqu'à son dernier message : les réponses suivantes de l'auteur restent non lues.
    const lastAdmin = t.lines.filter(([, who]) => who === "admin").at(-1)?.[0] ?? t.lines[0][0] + 1;
    await client.query(
      `INSERT INTO conversation_members (conversation_id, user_id, last_read_at) VALUES
       ($1, $2, now() - make_interval(mins => $3)), ($1, $4, now())`,
      [conv.id, admin.id, lastAdmin, project.owner_id],
    );
    for (const [minutesAgo, who, body] of t.lines) {
      await client.query(
        `INSERT INTO messages (conversation_id, sender_id, body, created_at)
         VALUES ($1, $2, $3, now() - make_interval(mins => $4))`,
        [conv.id, who === "admin" ? admin.id : project.owner_id, body, minutesAgo],
      );
    }
    await client.query(
      "UPDATE conversations SET updated_at = now() - make_interval(mins => $2) WHERE id = $1",
      [conv.id, t.lines.at(-1)![0]],
    );
    created++;
  }
  return created;
}

// Ressources de démo : fichiers et liens envoyés par les auteurs dans leurs discussions de projet.
type DemoFile = { name: string; mime: string; data: () => Buffer };
const DEMO_RESOURCES: { email: string; project: string; minutesAgo: number; body: string; files: DemoFile[] }[] = [
  {
    email: "josie@madalogistique.example",
    project: "Suivi des palettes",
    minutesAgo: 9,
    body: "Voici les étiquettes QR et une photo de l'entrepôt.",
    files: [
      { name: "etiquettes-qr.png", mime: "image/png", data: () => gradientPng(480, 320, [14, 116, 144], [34, 197, 94]) },
      { name: "photo-entrepot.png", mime: "image/png", data: () => gradientPng(480, 320, [120, 53, 15], [245, 158, 11]) },
    ],
  },
  {
    email: "greg@agence-nova.example",
    project: "Plateforme de partenariat",
    minutesAgo: 60 * 28,
    body: "Notre proposition détaillée en PDF. Portfolio : https://agence-nova.example/portfolio",
    files: [
      {
        name: "proposition-partenariat.pdf",
        mime: "application/pdf",
        data: () =>
          simplePdf("Proposition de partenariat", [
            "Agence Nova x TwinsChat",
            "3 sites clients par mois, maintenance comprise.",
            "Demarrage souhaite : janvier.",
          ]),
      },
    ],
  },
  {
    email: "elanor@example.com",
    project: "Boutique en ligne Lova",
    minutesAgo: 60 * 3,
    body: "Le catalogue des articles et la maquette : https://www.figma.com/file/boutique-lova",
    files: [
      {
        name: "catalogue-articles.csv",
        mime: "text/csv",
        data: () =>
          Buffer.from(
            "reference;article;taille;prix_ar\nLV-001;Robe lin;M;85000\nLV-002;Chemise coton;L;62000\nLV-003;Jupe plissee;S;54000\n",
            "utf8",
          ),
      },
    ],
  },
];

/** Ajoute les ressources de démo (une seule fois : repère = premier nom de fichier). */
export async function seedDemoResources(client: Client) {
  const { rows: [admin] } = await client.query<{ id: string }>(
    "SELECT id FROM users WHERE email = $1 AND role = 'admin'",
    [process.env.ADMIN_EMAIL ?? "admin@twinslack.app"],
  );
  if (!admin) return 0;
  const dir = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "storage/uploads");
  await mkdir(dir, { recursive: true });

  let created = 0;
  for (const r of DEMO_RESOURCES) {
    const { rowCount: exists } = await client.query("SELECT 1 FROM attachments WHERE file_name = $1", [r.files[0].name]);
    if (exists) continue;
    const { rows: [ctx] } = await client.query<{ conversation_id: string; owner_id: string }>(
      `SELECT c.id AS conversation_id, p.owner_id FROM conversations c
         JOIN projects p ON p.id = c.project_id JOIN users u ON u.id = p.owner_id
        WHERE u.email = $1 AND p.title = $2`,
      [r.email, r.project],
    );
    if (!ctx) continue;
    const { rows: [message] } = await client.query<{ id: string }>(
      `INSERT INTO messages (conversation_id, sender_id, body, created_at)
       VALUES ($1, $2, $3, now() - make_interval(mins => $4)) RETURNING id`,
      [ctx.conversation_id, ctx.owner_id, r.body, r.minutesAgo],
    );
    for (const f of r.files) {
      const key = randomUUID();
      const data = f.data();
      await writeFile(path.join(dir, key), data);
      await client.query(
        `INSERT INTO attachments (conversation_id, message_id, uploaded_by, file_name, mime_type, size_bytes, storage_key, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now() - make_interval(mins => $8))`,
        [ctx.conversation_id, message.id, ctx.owner_id, f.name, f.mime, data.length, key, r.minutesAgo],
      );
      created++;
    }
  }
  return created;
}
