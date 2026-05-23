import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { sql, getUserById, type User } from "./db";

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
export async function createSession(userId: string): Promise<string> {
  const token = genToken();
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 86400 * 1000,
  ).toISOString();
  await sql`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (${token}, ${userId}, ${expiresAt})
  `;
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
export async function getCurrentUser(): Promise<User | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;

  const rows = await sql<SessionRow[]>`
    SELECT * FROM sessions WHERE token = ${token}
  `;
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await sql`DELETE FROM sessions WHERE token = ${token}`;
    return null;
  }
  const user = await getUserById(row.user_id);
  if (!user || !user.is_active) return null;
  return user;
}

/** Destroy the current session and clear the cookie. */
export async function destroySession(): Promise<void> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (token) {
    await sql`DELETE FROM sessions WHERE token = ${token}`;
  }
  cookies().set({ name: COOKIE_NAME, value: "", path: "/", maxAge: 0 });
}

/** Purge expired sessions — call occasionally. */
export async function purgeExpiredSessions(): Promise<void> {
  await sql`DELETE FROM sessions WHERE expires_at < now()`;
}
