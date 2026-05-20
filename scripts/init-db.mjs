#!/usr/bin/env node
// Initialize the local SQLite DB, apply schema, and seed sample stores + packers.
// Usage: npm run db:init

import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DB_PATH = process.env.SALARY_DB_PATH ?? path.join(process.cwd(), "data", "app.db");
const SCHEMA_PATH = path.join(process.cwd(), "db", "schema.sql");

const dir = path.dirname(DB_PATH);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON;");
db.exec(readFileSync(SCHEMA_PATH, "utf8"));

// Seed two sample stores if none exist
const storeCount = db.prepare("SELECT COUNT(*) AS n FROM stores").get().n;
if (storeCount === 0) {
  const insStore = db.prepare("INSERT INTO stores (id, code, name) VALUES (?, ?, ?)");
  const ncrId = randomUUID();
  const mumId = randomUUID();
  insStore.run(ncrId, "NCR01", "Delhi - Connaught Place");
  insStore.run(mumId, "MUM02", "Mumbai - Bandra");

  const insPacker = db.prepare(`
    INSERT INTO packers (id, emp_id, name, store_id, is_active, bank_details_status)
    VALUES (?, ?, ?, ?, 1, 'missing')
  `);
  const sample = [
    [ncrId, "PKR001", "Ramesh Kumar"],
    [ncrId, "PKR002", "Sunita Sharma"],
    [ncrId, "PKR003", "Amit Verma"],
    [mumId, "PKR101", "Priya Patel"],
    [mumId, "PKR102", "Vikram Singh"],
  ];
  for (const [sid, emp, name] of sample) insPacker.run(randomUUID(), emp, name, sid);

  // Open the current month's cycle
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  db.prepare("INSERT INTO cycles (id, month, status) VALUES (?, ?, 'open')").run(randomUUID(), month);
  console.log(`Seeded 2 stores, 5 packers, and opened cycle ${month}.`);
} else {
  console.log("Schema applied. Existing data preserved.");
}

console.log(`Database ready at: ${DB_PATH}`);
console.log(`Next: npm run db:create-admin -- <email> <password>`);
