// Global setup — runs ONCE before all tests start.
// Wipes ./data/test.db and seeds it from db/schema.sql + fixture rows.
// Idempotent: safe to run repeatedly.

import { DatabaseSync } from "node:sqlite";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";
import { readFileSync, existsSync, unlinkSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TEST_DB_PATH = path.join(ROOT, "data", "test.db");
const SCHEMA = readFileSync(path.join(ROOT, "db", "schema.sql"), "utf8");

function hash(pw) {
  const salt = randomBytes(16);
  const buf = scryptSync(pw, salt, 64, { N: 16384 });
  return `scrypt$${salt.toString("hex")}$${buf.toString("hex")}`;
}

export default async function globalSetup() {
  mkdirSync(path.dirname(TEST_DB_PATH), { recursive: true });

  // Remove existing test DB + WAL siblings for a clean slate
  for (const f of [TEST_DB_PATH, TEST_DB_PATH + "-wal", TEST_DB_PATH + "-shm"]) {
    if (existsSync(f)) unlinkSync(f);
  }

  const db = new DatabaseSync(TEST_DB_PATH);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);

  // ---------- Seed ----------
  const ncrId = randomUUID();
  const mumId = randomUUID();
  db.prepare("INSERT INTO stores (id, code, name) VALUES (?, ?, ?)").run(ncrId, "NCR01", "Delhi - Connaught Place");
  db.prepare("INSERT INTO stores (id, code, name) VALUES (?, ?, ?)").run(mumId, "MUM02", "Mumbai - Bandra");

  const adminId = randomUUID();
  const mgrNcrId = randomUUID();
  const mgrMumId = randomUUID();
  db.prepare(`
    INSERT INTO users (id, email, password_hash, role, store_id, is_active, must_change_password)
    VALUES (?, ?, ?, 'admin', NULL, 1, 0)
  `).run(adminId, "admin@test.local", hash("admin12345"));
  db.prepare(`
    INSERT INTO users (id, email, password_hash, role, store_id, is_active, must_change_password)
    VALUES (?, ?, ?, 'manager', ?, 1, 0)
  `).run(mgrNcrId, "mgr.ncr@test.local", hash("manager12345"), ncrId);
  db.prepare(`
    INSERT INTO users (id, email, password_hash, role, store_id, is_active, must_change_password)
    VALUES (?, ?, ?, 'manager', ?, 1, 0)
  `).run(mgrMumId, "mgr.mum@test.local", hash("manager12345"), mumId);

  const insertPacker = db.prepare(
    "INSERT INTO packers (id, emp_id, name, store_id, is_active) VALUES (?, ?, ?, ?, 1)",
  );
  for (const row of [
    ["PKR001", "Ramesh Kumar", ncrId],
    ["PKR002", "Sunita Sharma", ncrId],
    ["PKR003", "Amit Verma", ncrId],
    ["PKR101", "Priya Patel", mumId],
    ["PKR102", "Vikram Singh", mumId],
  ]) {
    insertPacker.run(randomUUID(), row[0], row[1], row[2]);
  }

  // Open a cycle for the current month so edits aren't blocked
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  db.prepare("INSERT INTO cycles (id, month, status, opened_by) VALUES (?, ?, 'open', ?)")
    .run(randomUUID(), month, adminId);

  db.close();
  console.log(`[e2e] seeded ${TEST_DB_PATH} (cycle ${month} open, 5 packers, 2 managers)`);
}
