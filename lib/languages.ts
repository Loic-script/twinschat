/**
 * Langues du profil : codes ISO 639-1 enregistrés en base (ex. ["fr", "mg", "en"]),
 * noms affichés en français. Utilisable côté serveur comme côté client.
 */

/** Langues proposées directement (dans cet ordre). */
export const MAIN_LANGUAGES = ["fr", "mg", "en", "es", "it"] as const;

const MAIN_LABELS: Record<string, string> = {
  fr: "Français",
  mg: "Malagasy",
  en: "Anglais",
  es: "Espagnol",
  it: "Italien",
};

/** Toutes les langues ISO 639-1 (choix « Autre »). */
export const ALL_LANGUAGE_CODES = (
  "aa ab af ak am an ar as av ay az ba be bg bi bm bn bo br bs ca ce ch co cr cs cv cy da de dv dz ee el en eo es et eu " +
  "fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ig ii ik is it iu ja jv ka kg ki kj kk kl km " +
  "kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc " +
  "oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk " +
  "tl tn to tr ts tt tw ty ug uk ur uz ve vi wa wo xh yi yo za zh zu"
).split(" ");

const CODES = new Set(ALL_LANGUAGE_CODES);
export const isLanguageCode = (value: unknown): value is string => typeof value === "string" && CODES.has(value);

let names: Intl.DisplayNames | null = null;

/** Nom français d'une langue (« Malagasy » pour mg), avec une majuscule. */
export function languageName(code: string) {
  if (MAIN_LABELS[code]) return MAIN_LABELS[code];
  try {
    names ??= new Intl.DisplayNames(["fr"], { type: "language" });
    const name = names.of(code) ?? code;
    return name.charAt(0).toLocaleUpperCase("fr") + name.slice(1);
  } catch {
    return code;
  }
}

/** Liste lisible : « Français, Malagasy, Anglais ». */
export const formatLanguages = (codes: string[]) => codes.map(languageName).join(", ");
