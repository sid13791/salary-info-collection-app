import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getDb, getUserById, type User } from "./db";

const COOKIE_NAME = "salary_session";
const SESSION_TTL_DAYS = 30;

export interface SessionRow {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

function genToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Create a new session, set the cookie, return the token. */
export function createSession(userId: string): string {
  const token = genToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400 * 1000).toISOString();
  getDb()
    .prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
    .run(token, userId, expiresAt);
  cookies().set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 86400,
    secure: process.env.NODE_ENV === "production",
  });
  return token;
}

/** Read the current session user, or null. Verifies token + not expired. */
export function getCurrentUser(): User | null {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;

  const row = getDb()
    .prepare("SELECT * FROM sessions WHERE token = ?")
    .get(token) as SessionRow | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }
  const user = getUserById(row.user_id);
  if (!user || !user.is_active) return null;
  return user;
}

/** Destroy the current session and clear the cookie. */
export function destroySession(): void {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (token) {
    getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }
  cookies().set({ name: COOKIE_NAME, value: "", path: "/", maxAge: 0 });
}

/** Purge expired sessions — call occasionally. */
export function purgeExpiredSessions(): void {
  getDb().prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
}
