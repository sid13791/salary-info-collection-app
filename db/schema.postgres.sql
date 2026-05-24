-- Salary Info Collection App — Postgres schema (Supabase / hosted).
-- Translated from db/schema.sql (SQLite). Applied by `npm run db:init`.

CREATE TABLE IF NOT EXISTS stores (
  id          TEXT PRIMARY KEY,
  name        TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id                     TEXT PRIMARY KEY,
  email                  TEXT UNIQUE NOT NULL,
  password_hash          TEXT NOT NULL,
  role                   TEXT NOT NULL CHECK (role IN ('admin','manager')),
  store_id               TEXT REFERENCES stores(id),
  is_active              SMALLINT NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  must_change_password   SMALLINT NOT NULL DEFAULT 1 CHECK (must_change_password IN (0,1)),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (role = 'manager' AND store_id IS NOT NULL) OR
    (role = 'admin'   AND store_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS packers (
  id                   TEXT PRIMARY KEY,
  emp_id               TEXT NOT NULL,
  name                 TEXT NOT NULL,
  store_id             TEXT NOT NULL REFERENCES stores(id),
  is_active            SMALLINT NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  bank_account_no      TEXT,
  ifsc_code            TEXT,
  phone                TEXT,
  bank_details_status  TEXT NOT NULL DEFAULT 'missing'
                       CHECK (bank_details_status IN ('missing','provided')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (emp_id, store_id),
  CHECK (ifsc_code       IS NULL OR ifsc_code       ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  CHECK (bank_account_no IS NULL OR bank_account_no ~ '^[0-9]{9,18}$'),
  CHECK (phone           IS NULL OR phone           ~ '^[0-9]{10}$')
);

CREATE INDEX IF NOT EXISTS packers_store_id_idx  ON packers(store_id);
CREATE INDEX IF NOT EXISTS packers_is_active_idx ON packers(is_active);

CREATE TABLE IF NOT EXISTS cycles (
  id          TEXT PRIMARY KEY,
  month       TEXT NOT NULL UNIQUE CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  opened_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_by   TEXT REFERENCES users(id),
  closed_at   TIMESTAMPTZ,
  closed_by   TEXT REFERENCES users(id)
);

-- Only ONE cycle can be open at a time (Postgres partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS cycles_one_open_idx
  ON cycles(status) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS cycle_packers (
  id              TEXT PRIMARY KEY,
  cycle_id        TEXT NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  packer_id       TEXT NOT NULL REFERENCES packers(id),
  emp_id          TEXT NOT NULL,
  name            TEXT NOT NULL,
  store_id        TEXT NOT NULL REFERENCES stores(id),
  bank_account_no TEXT,
  ifsc_code       TEXT,
  phone           TEXT,
  is_active       SMALLINT NOT NULL CHECK (is_active IN (0,1)),
  snapshotted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, packer_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  packer_id      TEXT REFERENCES packers(id),
  field_changed  TEXT NOT NULL,
  old_value      TEXT,
  new_value      TEXT,
  changed_by     TEXT REFERENCES users(id),
  changed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_packer_idx     ON audit_log(packer_id);
CREATE INDEX IF NOT EXISTS audit_log_changed_at_idx ON audit_log(changed_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
