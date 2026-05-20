#!/usr/bin/env node
// Create an admin user. Usage: npm run db:create-admin -- <email> <password>

import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";

const [, , emailArg, passwordArg] = process.argv;
if (!emailArg || !passwordArg) {
  console.error("Usage: npm run db:create-admin -- <email> <password>");
  process.exit(1);
}
if (passwordArg.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const DB_PATH = process.env.SALARY_DB_PATH ?? path.join(process.cwd(), "data", "app.db");
const email = emailArg.toLowerCase().trim();

function hashPassword(pw) {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 64, { N: 16384 });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON;");

const existing = db.prepare("SELECT id, role FROM users WHERE email = ?").get(email);
if (existing) {
  if (existing.role !== "admin") {
    console.error(`User ${email} exists but is a ${existing.role}, not admin.`);
    process.exit(1);
  }
  // Reset password
  db.prepare("UPDATE users SET password_hash = ?, is_active = 1 WHERE email = ?")
    .run(hashPassword(passwordArg), email);
  console.log(`Reset password for existing admin ${email}.`);
} else {
  db.prepare(`
    INSERT INTO users (id, email, password_hash, role, store_id, is_active, must_change_password)
    VALUES (?, ?, ?, 'admin', NULL, 1, 1)
  `).run(randomUUID(), email, hashPassword(passwordArg));
  console.log(`Created admin ${email}.`);
}
console.log("You can now sign in at http://localhost:3000/login");
