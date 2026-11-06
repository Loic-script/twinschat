import "server-only";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const KEY_LENGTH = 64;

/** Empreinte du mot de passe : « scrypt:<sel hex>:<empreinte hex> » (jamais le mot de passe en clair). */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

/** Vérifie un mot de passe contre son empreinte (comparaison en temps constant). */
export async function verifyPassword(password: string, stored: string) {
  const [algo, saltHex, hashHex] = stored.split(":");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Règle minimale : 8 caractères, au moins une lettre et un chiffre. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "8 caractères minimum.";
  if (password.length > 128) return "128 caractères maximum.";
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) return "Utilisez au moins une lettre et un chiffre.";
  return null;
}
