import "server-only";

/*
 * Appel à l'API Mistral (chat), partagé par la traduction des messages et l'assistant de réponse.
 * Clé : MISTRAL_API_KEY (.env.local), jamais envoyée au navigateur.
 * Modèles : MISTRAL_MODEL (défaut mistral-small-latest), puis MISTRAL_FALLBACK_MODEL (défaut ministral-8b-latest) si la limite est atteinte.
 */

const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

/** Erreur Mistral avec un message lisible ; `status` : code HTTP (0 si le service ne répond pas). */
export class MistralError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const mistralConfigured = () => !!process.env.MISTRAL_API_KEY;

/** Envoie une consigne (system) et un contenu (user) ; renvoie le texte de la réponse. */
export async function mistralChat({
  system,
  user,
  json = false,
  temperature = 0,
  maxTokens,
  timeoutMs = 30_000,
}: {
  system: string;
  user: string;
  /** Réponse en JSON (format imposé par l'API). */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<string> {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) throw new MistralError("L'IA Mistral n'est pas configurée (MISTRAL_API_KEY).", 0);

  const primary = process.env.MISTRAL_MODEL || "mistral-small-latest";
  const fallback = process.env.MISTRAL_FALLBACK_MODEL || "ministral-8b-latest";
  const ask = (model: string) => callMistral(key, model, { system, user, json, temperature, maxTokens, timeoutMs });
  try {
    return await ask(primary);
  } catch (err) {
    // Limite atteinte sur le modèle principal (fréquent en offre gratuite) : un modèle plus léger prend le relais
    if (err instanceof MistralError && err.status === 429 && fallback !== primary) return ask(fallback);
    throw err;
  }
}

async function callMistral(
  key: string,
  model: string,
  {
    system,
    user,
    json,
    temperature,
    maxTokens,
    timeoutMs,
  }: { system: string; user: string; json: boolean; temperature: number; maxTokens?: number; timeoutMs: number },
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(MISTRAL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature,
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
        ...(json ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch {
    throw new MistralError("Le service Mistral ne répond pas. Réessayez.", 0);
  }

  if (!res.ok) {
    // Détail pour le serveur seulement (jamais la clé)
    const detail = await res.text().catch(() => "");
    console.error(`[mistral] ${model} ${res.status} ${detail.slice(0, 300)}`);
    throw new MistralError(
      res.status === 401 || res.status === 403
        ? "La clé Mistral est refusée : vérifiez MISTRAL_API_KEY."
        : res.status === 429
          ? "Limite d'utilisation de Mistral atteinte. Réessayez dans un moment."
          : "Le service Mistral est momentanément indisponible.",
      res.status,
    );
  }

  const data = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    console.error("[mistral] réponse vide ou inattendue");
    throw new MistralError("Mistral n'a pas renvoyé de réponse.", 502);
  }
  return content;
}
