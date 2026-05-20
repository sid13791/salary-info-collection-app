import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16384; // memory cost (2^14)
const KEY_LEN = 64;
const SALT_LEN = 16;

/** Hash a password — returns `scrypt$<saltHex>$<hashHex>` for storage. */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/** Constant-time password verification. Returns true on match. */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (salt.length !== SALT_LEN || expected.length !== KEY_LEN) return false;
  const actual = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N });
  return timingSafeEqual(actual, expected);
}
