-- Salary Info Collection App — Schema
-- Run in Supabase SQL editor. Idempotent where reasonable.

-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
-- Tables
-- ============================================================

create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  created_at timestamptz not null default now()
);

-- App-level user profile, linked 1:1 to auth.users
create table if not exists app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'manager')),
  store_id uuid references stores(id) on delete restrict,
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  -- managers MUST have a store; admins MUST NOT
  constraint store_required_for_manager check (
    (role = 'manager' and store_id is not null) or
    (role = 'admin' and store_id is null)
  )
);

create table if not exists packers (
  id uuid primary key default gen_random_uuid(),
  emp_id text not null,
  name text not null,
  store_id uuid not null references stores(id) on delete restrict,
  is_active boolean not null default true,
  bank_account_no text,
  ifsc_code text,
  phone text,
  bank_details_status text not null default 'missing'
    check (bank_details_status in ('missing', 'provided')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (emp_id, store_id),
  -- format constraints (cannot be bypassed via SQL injection at app layer)
  constraint ifsc_format check (
    ifsc_code is null or ifsc_code ~ '^[A-Z]{4}0[A-Z0-9]{6}$'
  ),
  constraint bank_account_format check (
    bank_account_no is null or bank_account_no ~ '^[0-9]{9,18}$'
  ),
  constraint phone_format check (
    phone is null or phone ~ '^[0-9]{10}$'
  )
);

create index if not exists packers_store_id_idx on packers(store_id);
create index if not exists packers_is_active_idx on packers(is_active);

create table if not exists cycles (
  id uuid primary key default gen_random_uuid(),
  month text not null unique, -- YYYY-MM
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  opened_by uuid references auth.users(id),
  closed_at timestamptz,
  closed_by uuid references auth.users(id),
  constraint month_format check (month ~ '^\d{4}-(0[1-9]|1[0-2])$')
);

-- Only ONE cycle can be open at a time
create unique index if not exists cycles_one_open_idx
  on cycles(status) where status = 'open';

create table if not exists cycle_packers (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references cycles(id) on delete cascade,
  packer_id uuid not null references packers(id) on delete restrict,
  emp_id text not null,
  name text not null,
  store_id uuid not null references stores(id),
  bank_account_no text,
  ifsc_code text,
  phone text,
  is_active boolean not null,
  snapshotted_at timestamptz not null default now(),
  unique (cycle_id, packer_id)
);

create table if not exists audit_log (
  id bigserial primary key,
  packer_id uuid references packers(id) on delete set null,
  field_changed text not null,
  old_value text,
  new_value text,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

create index if not exists audit_log_packer_idx on audit_log(packer_id);
create index if not exists audit_log_changed_at_idx on audit_log(changed_at desc);

-- ============================================================
-- Helpers
-- ============================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists packers_set_updated_at on packers;
create trigger packers_set_updated_at
  before update on packers
  for each row execute function set_updated_at();

-- Returns the currently-open cycle id, or null
create or replace function current_open_cycle_id()
returns uuid language sql stable as $$
  select id from cycles where status = 'open' limit 1;
$$;

-- Returns true if the calling auth user is an admin
create or replace function is_admin()
returns boolean language sql stable as $$
  select exists(
    select 1 from app_users
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

-- Returns the store_id assigned to the calling manager, or null
create or replace function my_store_id()
returns uuid language sql stable as $$
  select store_id from app_users
  where id = auth.uid() and role = 'manager' and is_active
  limit 1;
$$;
