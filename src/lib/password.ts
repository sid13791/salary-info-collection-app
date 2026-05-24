import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 32768; // memory cost (2^15, OWASP minimum)
const SCRYPT_N_LEGACY = 16384; // old cost parameter for backward-compatible verify
const KEY_LEN = 64;
const SALT_LEN = 16;
const MAX_MEM = 64 * 1024 * 1024; // 64 MB — Node 24 defaults to 32 MB which is exactly at the boundary for N=32768,r=8

/**
 * Hash a password.
 * New format: `scrypt$<N>$<saltHex>$<hashHex>` (4 parts, includes cost parameter).
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: 8, p: 1, maxmem: MAX_MEM });
  return `scrypt$${SCRYPT_N}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/**
 * Constant-time password verification.
 * Supports both old format (`scrypt$salt$hash`, assumes N=16384)
 * and new format (`scrypt$N$salt$hash`).
 */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts[0] !== "scrypt") return false;

  let n: number;
  let salt: Buffer;
  let expected: Buffer;

  if (parts.length === 4) {
    // New format: scrypt$N$salt$hash
    n = parseInt(parts[1], 10);
    if (!n || n < 1024) return false;
    salt = Buffer.from(parts[2], "hex");
    expected = Buffer.from(parts[3], "hex");
  } else if (parts.length === 3) {
    // Legacy format: scrypt$salt$hash (N=16384)
    n = SCRYPT_N_LEGACY;
    salt = Buffer.from(parts[1], "hex");
    expected = Buffer.from(parts[2], "hex");
  } else {
    return false;
  }

  if (salt.length !== SALT_LEN || expected.length !== KEY_LEN) return false;
  const actual = scryptSync(password, salt, KEY_LEN, { N: n, r: 8, p: 1, maxmem: MAX_MEM });
  return timingSafeEqual(actual, expected);
}
