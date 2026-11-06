/**
 * Règles des pièces jointes, partagées entre le navigateur (vérification immédiate)
 * et le serveur (vérification de référence).
 */

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 Mo par fichier
export const MAX_FILES_PER_MESSAGE = 10;

export type AttachmentKind = "image" | "video" | "audio" | "fichier";

/**
 * Types connus, déduits de l'extension. Tous les fichiers sont acceptés : un type inconnu
 * est enregistré tel qu'annoncé par le navigateur, sinon comme fichier binaire. La sécurité
 * se joue à l'affichage (voir INLINE_MIME) : le reste est toujours téléchargé, jamais ouvert.
 */
const MIME_BY_EXTENSION: Record<string, string> = {
  svg: "image/svg+xml",
  bmp: "image/bmp",
  ico: "image/x-icon",
  tif: "image/tiff",
  tiff: "image/tiff",
  psd: "image/vnd.adobe.photoshop",
  ai: "application/postscript",
  eps: "application/postscript",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  flac: "audio/flac",
  html: "text/html",
  htm: "text/html",
  json: "application/json",
  xml: "application/xml",
  md: "text/markdown",
  rtf: "application/rtf",
  apk: "application/vnd.android.package-archive",
  exe: "application/octet-stream",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  heic: "image/heic",
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  ogv: "video/ogg",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  txt: "text/plain",
  csv: "text/csv",
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
};

/**
 * Types que le navigateur peut afficher directement (le reste est téléchargé, jamais exécuté).
 * Le SVG est servi avec une politique « sandbox » qui bloque tout script (voir /api/fichiers/[id]).
 */
const INLINE_MIME = new Set([
  "image/svg+xml",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/wav",
  "audio/ogg",
  "application/pdf",
]);

export const ACCEPT_MEDIA = "image/*,video/*";
/** Sélecteur de fichiers : tous les formats. */
export const ACCEPT_ALL = undefined;

const MIME_RE = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,63}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,63}$/;

/**
 * Type MIME retenu pour un fichier : celui déduit de l'extension s'il est connu,
 * sinon celui annoncé par le navigateur (s'il est bien formé), sinon fichier binaire.
 */
export function resolveMime(fileName: string, declared: string): string {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (MIME_BY_EXTENSION[ext]) return MIME_BY_EXTENSION[ext];
  const type = declared.toLowerCase().split(";")[0].trim();
  return MIME_RE.test(type) ? type : "application/octet-stream";
}

export function isInlineMime(mime: string) {
  return INLINE_MIME.has(mime);
}

export function attachmentKind(mime: string): AttachmentKind {
  if (!isInlineMime(mime)) return "fichier";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "fichier";
}

/** Message d'erreur si le fichier est refusé, sinon `null`. */
export function checkFile(file: { name: string; type: string; size: number }): string | null {
  if (file.size > MAX_FILE_SIZE) return `« ${file.name} » dépasse 50 Mo.`;
  if (file.size === 0) return `« ${file.name} » est vide.`;
  return null;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0).replace(".", ",")} Mo`;
}

export const attachmentUrl = (id: string) => `/api/fichiers/${id}`;

/** Adresse qui télécharge le fichier au lieu de l'ouvrir dans le navigateur. */
export const downloadUrl = (id: string) => `/api/fichiers/${id}?download=1`;
