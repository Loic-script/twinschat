-- TwinSlack : schéma de messagerie
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'utilisateur', 'client', 'entreprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('en_ligne', 'absent', 'hors_ligne');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE conversation_kind AS ENUM ('direct', 'groupe');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  role          user_role NOT NULL DEFAULT 'utilisateur',
  company       TEXT,
  avatar_url    TEXT,
  status        user_status NOT NULL DEFAULT 'hors_ligne',
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        conversation_kind NOT NULL DEFAULT 'direct',
  title       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at     TIMESTAMPTZ NOT NULL DEFAULT 'epoch',
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body             TEXT NOT NULL,
  pinned           BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at        TIMESTAMPTZ,
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS conversation_members_user_idx
  ON conversation_members (user_id);

-- Profils : informations affichées sur la page Utilisateurs
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS workplace   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address     TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city        TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS description TEXT;

-- Projets proposés par les utilisateurs, clients et entreprises
DO $$ BEGIN
  CREATE TYPE project_status AS ENUM ('propose', 'en_cours', 'termine');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  category      TEXT,
  description   TEXT,
  status        project_status NOT NULL DEFAULT 'propose',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS projects_owner_idx ON projects (owner_id, created_at DESC);

-- Lien associé à un projet (site, maquette, dépôt…)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS url TEXT;

-- Notifications de l'admin : date de dernière consultation et préférences
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_seen_at TIMESTAMPTZ NOT NULL DEFAULT 'epoch';
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL
  DEFAULT '{"messages": true, "inscriptions": true, "projets": true, "navigateur": false}';

-- Discussions de projet : une conversation par projet, entre l'admin et l'auteur du projet
ALTER TYPE conversation_kind ADD VALUE IF NOT EXISTS 'projet';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_project_idx
  ON conversations (project_id) WHERE project_id IS NOT NULL;

-- Pièces jointes des messages (photos, vidéos, documents…). Les fichiers sont sur disque
-- (dossier UPLOAD_DIR) ; message_id reste NULL tant que le message n'est pas envoyé.
CREATE TABLE IF NOT EXISTS attachments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id       UUID REFERENCES messages(id) ON DELETE CASCADE,
  uploaded_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name        TEXT NOT NULL,
  mime_type        TEXT NOT NULL,
  size_bytes       BIGINT NOT NULL,
  storage_key      TEXT NOT NULL UNIQUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attachments_message_idx ON attachments (message_id);

-- Dossiers de ressources créés par l'admin.
-- Un fichier importé directement dans un dossier n'appartient à aucune discussion.
ALTER TABLE attachments ALTER COLUMN conversation_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS resource_folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contenu d'un dossier : soit un fichier (pièce jointe), soit un lien.
CREATE TABLE IF NOT EXISTS resource_folder_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id          UUID NOT NULL REFERENCES resource_folders(id) ON DELETE CASCADE,
  attachment_id      UUID REFERENCES attachments(id) ON DELETE CASCADE,
  link_url           TEXT,
  link_title         TEXT,
  source_message_id  UUID REFERENCES messages(id) ON DELETE SET NULL,
  added_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  added_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((attachment_id IS NOT NULL) <> (link_url IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS folder_items_attachment_uniq
  ON resource_folder_items (folder_id, attachment_id) WHERE attachment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS folder_items_link_uniq
  ON resource_folder_items (folder_id, link_url) WHERE link_url IS NOT NULL;

-- Accès accordés par l'admin aux éléments de ses dossiers (fichier ou lien)
CREATE TABLE IF NOT EXISTS resource_item_access (
  item_id     UUID NOT NULL REFERENCES resource_folder_items(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, user_id)
);
CREATE INDEX IF NOT EXISTS resource_item_access_user_idx ON resource_item_access (user_id);

-- Profil : téléphone et photo (fichier dans UPLOAD_DIR, servi par /api/avatars/[userId])
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_mime TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ;

-- Compte : mot de passe (empreinte scrypt, jamais en clair) et photo de couverture du profil
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_mime TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_updated_at TIMESTAMPTZ;

-- Paiement du projet (date du paiement, NULL = non payé)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Sessions de connexion (connexion désactivée pour l'instant : table gardée pour la remettre).
-- Le jeton aléatoire reste dans le cookie (httpOnly) ;
-- la base ne garde que son empreinte SHA-256 : une fuite de la table ne permet pas d'usurper une session.
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

-- Réactions aux messages (une ligne par personne et par emoji)
CREATE TABLE IF NOT EXISTS message_reactions (
  message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

-- Profil : pays et langues parlées (codes ISO 639-1, ex. {fr,mg,en})
ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS languages TEXT[] NOT NULL DEFAULT '{}';
