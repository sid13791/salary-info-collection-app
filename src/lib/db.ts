import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const DB_PATH = process.env.SALARY_DB_PATH ?? path.join(process.cwd(), "data", "app.db");
const SCHEMA_PATH = path.join(process.cwd(), "db", "schema.sql");

let _db: DatabaseSync | null = null;

/** Singleton — opens DB on first use, applies schema if missing. */
export function getDb(): DatabaseSync {
  if (_db) return _db;

  const dir = path.dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA foreign_keys = ON;");

  // Apply schema (idempotent — all CREATE statements use IF NOT EXISTS)
  if (existsSync(SCHEMA_PATH)) {
    db.exec(readFileSync(SCHEMA_PATH, "utf8"));
  }

  _db = db;
  return db;
}

/** Generate a random UUID using built-in crypto (no extra deps). */
export function newId(): string {
  return crypto.randomUUID();
}

/** Domain types — mirror schema.sql rows. */
export type Role = "admin" | "manager";
export type CycleStatus = "open" | "closed";
export type BankDetailsStatus = "missing" | "provided";

export interface Store {
  id: string;
  code: string;
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
// Query helpers — small, focused, prepared-statement-backed.
// node:sqlite returns `Record<string, SQLOutputValue>`; we trust the schema
// matches our domain types and cast through `unknown`.
// ============================================================

// node:sqlite returns rows with a null prototype, which Next.js can't pass
// from Server to Client components. Re-spread into plain objects.
export function row<T>(v: unknown): T | null {
  if (v == null) return null;
  return { ...(v as object) } as T;
}
export function rows<T>(v: unknown): T[] {
  return (v as object[]).map((r) => ({ ...r }) as T);
}

export function getStores(): Store[] {
  return rows<Store>(getDb().prepare("SELECT * FROM stores ORDER BY code").all());
}
export function getStoreById(id: string): Store | null {
  return row<Store>(getDb().prepare("SELECT * FROM stores WHERE id = ?").get(id));
}
export function getStoreByCode(code: string): Store | null {
  return row<Store>(getDb().prepare("SELECT * FROM stores WHERE code = ?").get(code));
}
export function getUserByEmail(email: string): User | null {
  return row<User>(getDb().prepare("SELECT * FROM users WHERE email = ?").get(email));
}
export function getUserById(id: string): User | null {
  return row<User>(getDb().prepare("SELECT * FROM users WHERE id = ?").get(id));
}
export function getOpenCycle(): Cycle | null {
  return row<Cycle>(getDb().prepare("SELECT * FROM cycles WHERE status = 'open'").get());
}
export function getLatestClosedCycle(): Cycle | null {
  return row<Cycle>(
    getDb().prepare("SELECT * FROM cycles WHERE status = 'closed' ORDER BY closed_at DESC LIMIT 1").get(),
  );
}
export function getPackerById(id: string): Packer | null {
  return row<Packer>(getDb().prepare("SELECT * FROM packers WHERE id = ?").get(id));
}
export function getActivePackers(storeId?: string): Packer[] {
  const sql = storeId
    ? "SELECT * FROM packers WHERE is_active = 1 AND store_id = ? ORDER BY emp_id"
    : "SELECT * FROM packers WHERE is_active = 1 ORDER BY emp_id";
  return rows<Packer>(
    storeId ? getDb().prepare(sql).all(storeId) : getDb().prepare(sql).all(),
  );
}

export function deriveStatus(bank: string | null, ifsc: string | null): BankDetailsStatus {
  return bank && ifsc ? "provided" : "missing";
}

export function insertAudit(entry: {
  packer_id: string | null;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
}): void {
  getDb()
    .prepare(`
      INSERT INTO audit_log (packer_id, field_changed, old_value, new_value, changed_by)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(entry.packer_id, entry.field_changed, entry.old_value, entry.new_value, entry.changed_by);
}
