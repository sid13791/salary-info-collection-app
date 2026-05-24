// Global setup — runs ONCE before all tests start.
// Seeds test data into Supabase Postgres via postgres.js.
// Cleans and re-seeds each run for a deterministic starting state.

import postgres from "postgres";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";
import { config } from "dotenv";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL not set in .env.local — needed for E2E test setup");
}

function hash(pw) {
  const salt = randomBytes(16);
  const buf = scryptSync(pw, salt, 64, { N: 16384 });
  return `scrypt$${salt.toString("hex")}$${buf.toString("hex")}`;
}

export default async function globalSetup() {
  const sql = postgres(DATABASE_URL, { max: 1, idle_timeout: 5 });

  try {
    // Clean slate — delete in FK-safe order
    await sql`DELETE FROM cycle_packers`;
    await sql`DELETE FROM audit_log`;
    await sql`DELETE FROM cycles`;
    await sql`DELETE FROM packers`;
    await sql`DELETE FROM sessions`;
    await sql`DELETE FROM users`;
    await sql`DELETE FROM stores`;

    // ---------- Seed ----------
    const ncrId = randomUUID();
    const mumId = randomUUID();
    await sql`INSERT INTO stores (id, name) VALUES (${ncrId}, 'Delhi - Connaught Place')`;
    await sql`INSERT INTO stores (id, name) VALUES (${mumId}, 'Mumbai - Bandra')`;

    const adminId = randomUUID();
    const mgrNcrId = randomUUID();
    const mgrMumId = randomUUID();
    await sql`
      INSERT INTO users (id, email, password_hash, role, store_id, is_active, must_change_password)
      VALUES (${adminId}, 'admin@test.local', ${hash("admin12345")}, 'admin', NULL, 1, 0)
    `;
    await sql`
      INSERT INTO users (id, email, password_hash, role, store_id, is_active, must_change_password)
      VALUES (${mgrNcrId}, 'mgr.ncr@test.local', ${hash("manager12345")}, 'manager', ${ncrId}, 1, 0)
    `;
    await sql`
      INSERT INTO users (id, email, password_hash, role, store_id, is_active, must_change_password)
      VALUES (${mgrMumId}, 'mgr.mum@test.local', ${hash("manager12345")}, 'manager', ${mumId}, 1, 0)
    `;

    for (const [empId, name, storeId] of [
      ["PKR001", "Ramesh Kumar", ncrId],
      ["PKR002", "Sunita Sharma", ncrId],
      ["PKR003", "Amit Verma", ncrId],
      ["PKR101", "Priya Patel", mumId],
      ["PKR102", "Vikram Singh", mumId],
    ]) {
      await sql`
        INSERT INTO packers (id, emp_id, name, store_id, is_active)
        VALUES (${randomUUID()}, ${empId}, ${name}, ${storeId}, 1)
      `;
    }

    // Open a cycle for the current month so edits aren't blocked
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    await sql`
      INSERT INTO cycles (id, month, status, opened_by)
      VALUES (${randomUUID()}, ${month}, 'open', ${adminId})
    `;

    console.log(`[e2e] seeded Supabase (cycle ${month} open, 5 packers, 2 managers)`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
