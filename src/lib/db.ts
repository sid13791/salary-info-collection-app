import postgres from "postgres";

// Empty string is intentional: postgres.js accepts the call but defers
// connection until the first query. That keeps `next build` (which loads
// modules during page tracing) from failing when DATABASE_URL is absent on
// the build host. Queries at runtime fail loudly with a clear error.
const DATABASE_URL = process.env.DATABASE_URL ?? "";

declare global {
  // eslint-disable-next-line no-var
  var __pg: postgres.Sql | undefined;
}

// Singleton across hot reloads in dev so we don't exhaust the pool.
export const sql: postgres.Sql =
  global.__pg ??
  postgres(DATABASE_URL, {
    // Supavisor transaction-mode pooler (port 6543) does not support
    // server-side prepared statements. postgres.js sends queries as Simple Query
    // when prepare:false.
    prepare: false,
    // postgres.js normally runs a SELECT against pg_type at startup to learn
    // custom types. Supavisor in transaction mode hangs / statement-timeouts
    // on this — disable it. We don't use custom types in this app.
    fetch_types: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    // Return TIMESTAMPTZ as ISO 8601 strings (matches the old SQLite contract
    // where rows carried `datetime('now')` ISO-ish strings).
    types: {
      date: {
        to: 1184,
        from: [1082, 1083, 1114, 1184],
        serialize: (x: Date | string) =>
          x instanceof Date ? x.toISOString() : x,
        parse: (x: string) => new Date(x).toISOString(),
      },
    },
  });

if (process.env.NODE_ENV !== "production") global.__pg = sql;

/** Random UUID — used as primary key for stores, users, packers, cycles, etc. */
export function newId(): string {
  return crypto.randomUUID();
}

// ============================================================
// Domain types — mirror schema.postgres.sql rows.
// ============================================================
export type Role = "admin" | "manager";
export type CycleStatus = "open" | "closed";
export type BankDetailsStatus = "missing" | "provided";

export interface Store {
  id: string;
  name: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: Role;
  store_id: string | null;
  is_active: number; // 0|1
  must_change_password: number; // 0|1
  created_at: string;
}

export interface Packer {
  id: string;
  emp_id: string;
  name: string;
  store_id: string;
  is_active: number; // 0|1
  bank_account_no: string | null;
  ifsc_code: string | null;
  phone: string | null;
  bank_details_status: BankDetailsStatus;
  created_at: string;
  updated_at: string;
}

export interface Cycle {
  id: string;
  month: string;
  status: CycleStatus;
  opened_at: string;
  opened_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
}

export interface AuditEntry {
  id: number;
  packer_id: string | null;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
}

// ============================================================
// Query helpers — now async, backed by postgres.js tagged templates.
// ============================================================

export async function getStores(): Promise<Store[]> {
  const rows = await sql<Store[]>`SELECT * FROM stores ORDER BY name`;
  return [...rows];
}

export async function getStoreById(id: string): Promise<Store | null> {
  const rows = await sql<Store[]>`SELECT * FROM stores WHERE id = ${id}`;
  return rows[0] ?? null;
}

export async function getStoreByName(name: string): Promise<Store | null> {
  const rows = await sql<Store[]>`SELECT * FROM stores WHERE name = ${name}`;
  return rows[0] ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = await sql<User[]>`SELECT * FROM users WHERE email = ${email}`;
  return rows[0] ?? null;
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await sql<User[]>`SELECT * FROM users WHERE id = ${id}`;
  return rows[0] ?? null;
}

export async function getOpenCycle(): Promise<Cycle | null> {
  const rows = await sql<Cycle[]>`SELECT * FROM cycles WHERE status = 'open'`;
  return rows[0] ?? null;
}

export async function getLatestClosedCycle(): Promise<Cycle | null> {
  const rows = await sql<Cycle[]>`
    SELECT * FROM cycles WHERE status = 'closed'
    ORDER BY closed_at DESC LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getAllCycles(): Promise<Cycle[]> {
  const rows = await sql<Cycle[]>`SELECT * FROM cycles ORDER BY month DESC`;
  return [...rows];
}

export async function getPackerById(id: string): Promise<Packer | null> {
  const rows = await sql<Packer[]>`SELECT * FROM packers WHERE id = ${id}`;
  return rows[0] ?? null;
}

export async function getActivePackers(storeId?: string): Promise<Packer[]> {
  if (storeId) {
    const rows = await sql<Packer[]>`
      SELECT * FROM packers
      WHERE is_active = 1 AND store_id = ${storeId}
      ORDER BY emp_id
    `;
    return [...rows];
  }
  const rows = await sql<Packer[]>`
    SELECT * FROM packers WHERE is_active = 1 ORDER BY emp_id
  `;
  return [...rows];
}

export function deriveStatus(
  bank: string | null,
  ifsc: string | null,
): BankDetailsStatus {
  return bank && ifsc ? "provided" : "missing";
}

export async function insertAudit(entry: {
  packer_id: string | null;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
}): Promise<void> {
  await sql`
    INSERT INTO audit_log (packer_id, field_changed, old_value, new_value, changed_by)
    VALUES (
      ${entry.packer_id},
      ${entry.field_changed},
      ${entry.old_value},
      ${entry.new_value},
      ${entry.changed_by}
    )
  `;
}
