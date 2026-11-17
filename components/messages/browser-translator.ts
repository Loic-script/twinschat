/*
 * Traduction dans le navigateur (API Translator et LanguageDetector de Chrome 138+ sur ordinateur) :
 * gratuite, sans clé ni quota, et le texte ne quitte pas l'appareil.
 * Le premier usage d'une paire de langues télécharge un petit modèle (après un clic de l'utilisateur).
 */

type Availability = "unavailable" | "downloadable" | "downloading" | "available";
type CreateMonitor = (m: EventTarget) => void;

type TranslatorInstance = { translate(text: string): Promise<string> };
type DetectorInstance = { detect(text: string): Promise<{ detectedLanguage: string; confidence: number }[]> };

type TranslatorApi = {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<Availability>;
  create(o: { sourceLanguage: string; targetLanguage: string; monitor?: CreateMonitor }): Promise<TranslatorInstance>;
};
type DetectorApi = { create(o?: { monitor?: CreateMonitor }): Promise<DetectorInstance> };

const api = () => globalThis as unknown as { Translator?: TranslatorApi; LanguageDetector?: DetectorApi };

export class BrowserTranslationError extends Error {}

export type BrowserTranslation = { body: string; from: string | null };

/** Le navigateur sait-il traduire (Chrome récent sur ordinateur) ? */
export function browserTranslationSupported() {
  if (typeof window === "undefined") return false;
  const { Translator, LanguageDetector } = api();
  return !!Translator && !!LanguageDetector;
}

let detector: Promise<DetectorInstance> | null = null;
const translators = new Map<string, Promise<TranslatorInstance>>();
const results = new Map<string, BrowserTranslation>();

function monitorOf(onProgress?: (ratio: number) => void): CreateMonitor | undefined {
  if (!onProgress) return undefined;
  return (m) => m.addEventListener("downloadprogress", (e) => onProgress((e as Event & { loaded: number }).loaded));
}

function getDetector(onProgress?: (ratio: number) => void) {
  const { LanguageDetector } = api();
  if (!LanguageDetector) return Promise.reject(new BrowserTranslationError("unsupported"));
  if (!detector) {
    const created = LanguageDetector.create({ monitor: monitorOf(onProgress) });
    detector = created;
    // Échec (téléchargement refusé sans clic, par exemple) : on pourra réessayer
    created.catch(() => {
      if (detector === created) detector = null;
    });
  }
  return detector;
}

/** À appeler directement dans le clic : le téléchargement d'un modèle demande une action de l'utilisateur. */
export function warmUp(onProgress?: (ratio: number) => void) {
  getDetector(onProgress).catch(() => {});
}

async function detect(text: string) {
  const [best] = await (await getDetector()).detect(text);
  // Texte trop court ou incertain : on suppose du français (langue de l'équipe)
  if (!best || best.detectedLanguage === "und" || best.confidence < 0.4) return "fr";
  return best.detectedLanguage.split("-")[0];
}

function translatorFor(source: string, target: string, onProgress?: (ratio: number) => void) {
  const { Translator } = api();
  if (!Translator) return Promise.reject(new BrowserTranslationError("unsupported"));
  const key = `${source}>${target}`;
  let t = translators.get(key);
  if (!t) {
    t = (async () => {
      const availability = await Translator.availability({ sourceLanguage: source, targetLanguage: target });
      if (availability === "unavailable") throw new BrowserTranslationError("pair-unavailable");
      return Translator.create({ sourceLanguage: source, targetLanguage: target, monitor: monitorOf(onProgress) });
    })();
    translators.set(key, t);
    // Échec (paire indisponible, téléchargement refusé) : on pourra réessayer plus tard
    t.catch(() => translators.delete(key));
  }
  return t;
}

/**
 * Traduit un texte vers `target`. Renvoie le texte tel quel s'il est déjà dans cette langue.
 * Erreurs : BrowserTranslationError("unsupported" | "pair-unavailable"), ou celle du navigateur
 * (téléchargement du modèle refusé sans clic, par exemple).
 */
export async function translateInBrowser(
  text: string,
  target: string,
  onProgress?: (ratio: number) => void,
): Promise<BrowserTranslation> {
  const cacheKey = `${target}\u0000${text}`;
  const cached = results.get(cacheKey);
  if (cached) return cached;
  const from = await detect(text);
  const body = from === target ? text : await (await translatorFor(from, target, onProgress)).translate(text);
  const result = { body, from };
  results.set(cacheKey, result);
  return result;
}
