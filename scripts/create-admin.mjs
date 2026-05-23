#!/usr/bin/env node
// Create or reset an admin user against Supabase Postgres.
// Usage: npm run db:create-admin -- <email> <password>

import postgres from "postgres";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";
import { config } from "dotenv";

config({ path: ".env.local" });

const [, , emailArg, passwordArg] = process.argv;
if (!emailArg || !passwordArg) {
  console.error("Usage: npm run db:create-admin -- <email> <password>");
  process.exit(1);
}
if (passwordArg.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL_DIRECT (or DATABASE_URL) not set. Add it to .env.local.");
  process.exit(1);
}

const email = emailArg.toLowerCase().trim();

function hashPassword(pw) {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 64, { N: 32768, r: 8, p: 1 });
  return `scrypt$32768$${salt.toString("hex")}$${hash.toString("hex")}`;
}

const sql = postgres(DATABASE_URL, { max: 1, idle_timeout: 5 });

try {
  const existingRows = await sql`SELECT id, role FROM users WHERE email = ${email}`;
  const existing = existingRows[0];

  if (existing) {
    if (existing.role !== "admin") {
      console.error(`User ${email} exists but is a ${existing.role}, not admin.`);
      process.exit(1);
    }
    await sql`
      UPDATE users
      SET password_hash = ${hashPassword(passwordArg)}, is_active = 1
      WHERE email = ${email}
    `;
    // Invalidate all existing sessions for this user (WR-03)
    await sql`DELETE FROM sessions WHERE user_id = ${existing.id}`;
    console.log(`Reset password for existing admin ${email}. All existing sessions invalidated.`);
  } else {
    await sql`
      INSERT INTO users (id, email, password_hash, role, store_id, is_active, must_change_password)
      VALUES (${randomUUID()}, ${email}, ${hashPassword(passwordArg)}, 'admin', NULL, 1, 1)
    `;
    console.log(`Created admin ${email}.`);
  }
  console.log("You can now sign in at http://localhost:3000/login");
} finally {
  await sql.end({ timeout: 5 });
}
