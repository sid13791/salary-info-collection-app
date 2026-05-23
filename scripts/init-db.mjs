#!/usr/bin/env node
// Apply Postgres schema to Supabase and (optionally) seed sample data.
// Reads DATABASE_URL_DIRECT (port 5432) — the direct connection supports DDL.
// Usage: npm run db:init

import postgres from "postgres";
import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL_DIRECT (or DATABASE_URL) not set. Add it to .env.local.");
  process.exit(1);
}

const SCHEMA_PATH = path.join(process.cwd(), "db", "schema.postgres.sql");

const sql = postgres(DATABASE_URL, { max: 1, idle_timeout: 5 });

try {
  await sql.unsafe(readFileSync(SCHEMA_PATH, "utf8"));
  console.log("Schema applied.");

  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM stores`;
  if (n === 0) {
    const ncrId = randomUUID();
    const mumId = randomUUID();
    await sql`INSERT INTO stores (id, code, name) VALUES (${ncrId}, 'NCR01', 'Delhi - Connaught Place')`;
    await sql`INSERT INTO stores (id, code, name) VALUES (${mumId}, 'MUM02', 'Mumbai - Bandra')`;

    const sample = [
      [ncrId, "PKR001", "Ramesh Kumar"],
      [ncrId, "PKR002", "Sunita Sharma"],
      [ncrId, "PKR003", "Amit Verma"],
      [mumId, "PKR101", "Priya Patel"],
      [mumId, "PKR102", "Vikram Singh"],
    ];
    for (const [sid, emp, name] of sample) {
      await sql`
        INSERT INTO packers (id, emp_id, name, store_id, is_active, bank_details_status)
        VALUES (${randomUUID()}, ${emp}, ${name}, ${sid}, 1, 'missing')
      `;
    }

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    await sql`INSERT INTO cycles (id, month, status) VALUES (${randomUUID()}, ${month}, 'open')`;
    console.log(`Seeded 2 stores, 5 packers, and opened cycle ${month}.`);
  } else {
    console.log("Existing data preserved.");
  }

  console.log("Next: npm run db:create-admin -- <email> <password>");
} finally {
  await sql.end({ timeout: 5 });
}
