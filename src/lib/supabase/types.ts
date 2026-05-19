// Hand-written DB types matching db/schema.sql.
// (For a production project, generate these via `supabase gen types typescript`.)

export type Role = "admin" | "manager";
export type CycleStatus = "open" | "closed";
export type BankDetailsStatus = "missing" | "provided";

export interface Store {
  id: string;
  code: string;
  name: string;
  created_at: string;
}

export interface AppUser {
  id: string;
  email: string;
  role: Role;
  store_id: string | null;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
}

export interface Packer {
  id: string;
  emp_id: string;
  name: string;
  store_id: string;
  is_active: boolean;
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

export interface CyclePacker {
  id: string;
  cycle_id: string;
  packer_id: string;
  emp_id: string;
  name: string;
  store_id: string;
  bank_account_no: string | null;
  ifsc_code: string | null;
  phone: string | null;
  is_active: boolean;
  snapshotted_at: string;
}

export interface AuditLog {
  id: number;
  packer_id: string | null;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
}

// Database interface for typed Supabase client
export interface Database {
  public: {
    Tables: {
      stores: { Row: Store; Insert: Omit<Store, "id" | "created_at"> & { id?: string }; Update: Partial<Store> };
      app_users: { Row: AppUser; Insert: AppUser; Update: Partial<AppUser> };
      packers: { Row: Packer; Insert: Omit<Packer, "id" | "created_at" | "updated_at" | "bank_details_status"> & { id?: string }; Update: Partial<Packer> };
      cycles: { Row: Cycle; Insert: Omit<Cycle, "id" | "opened_at" | "closed_at"> & { id?: string }; Update: Partial<Cycle> };
      cycle_packers: { Row: CyclePacker; Insert: Omit<CyclePacker, "id" | "snapshotted_at"> & { id?: string }; Update: Partial<CyclePacker> };
      audit_log: { Row: AuditLog; Insert: Omit<AuditLog, "id" | "changed_at">; Update: Partial<AuditLog> };
    };
    Views: Record<string, never>;
    Functions: {
      current_open_cycle_id: { Args: Record<string, never>; Returns: string | null };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      my_store_id: { Args: Record<string, never>; Returns: string | null };
    };
    Enums: Record<string, never>;
  };
}
