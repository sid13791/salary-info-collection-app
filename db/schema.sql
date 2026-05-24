-- Salary Info Collection App — SQLite schema (local mode, no Supabase).
-- Applied by `npm run db:init`.

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS stores (
  id          TEXT PRIMARY KEY,
  name        TEXT UNIQUE NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id                     TEXT PRIMARY KEY,
  email                  TEXT UNIQUE NOT NULL,
  password_hash          TEXT NOT NULL,
  role                   TEXT NOT NULL CHECK (role IN ('admin','manager')),
  store_id               TEXT REFERENCES stores(id),
  is_active              INTEGER NOT NULL DEFAULT 1,
  must_change_password   INTEGER NOT NULL DEFAULT 1,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
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
  is_active            INTEGER NOT NULL DEFAULT 1,
  bank_account_no      TEXT,
  ifsc_code            TEXT,
  phone                TEXT,
  bank_details_status  TEXT NOT NULL DEFAULT 'missing'
                       CHECK (bank_details_status IN ('missing','provided')),
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (emp_id, store_id),
  CHECK (ifsc_code           IS NULL OR ifsc_code           GLOB '[A-Z][A-Z][A-Z][A-Z]0[A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9]'),
  CHECK (bank_account_no     IS NULL OR (length(bank_account_no) BETWEEN 9 AND 18 AND bank_account_no NOT GLOB '*[^0-9]*')),
  CHECK (phone               IS NULL OR (length(phone) = 10                AND phone           NOT GLOB '*[^0-9]*'))
);

CREATE INDEX IF NOT EXISTS packers_store_id_idx  ON packers(store_id);
CREATE INDEX IF NOT EXISTS packers_is_active_idx ON packers(is_active);

CREATE TABLE IF NOT EXISTS cycles (
  id          TEXT PRIMARY KEY,
  month       TEXT NOT NULL UNIQUE CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]'),
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  opened_at   TEXT NOT NULL DEFAULT (datetime('now')),
  opened_by   TEXT REFERENCES users(id),
  closed_at   TEXT,
  closed_by   TEXT REFERENCES users(id)
);

-- Only ONE cycle can be open at a time
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
  is_active       INTEGER NOT NULL,
  snapshotted_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (cycle_id, packer_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  packer_id      TEXT REFERENCES packers(id),
  field_changed  TEXT NOT NULL,
  old_value      TEXT,
  new_value      TEXT,
  changed_by     TEXT REFERENCES users(id),
  changed_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS audit_log_packer_idx     ON audit_log(packer_id);
CREATE INDEX IF NOT EXISTS audit_log_changed_at_idx ON audit_log(changed_at DESC);

-- Session table — server-side session storage (cookie holds opaque token only)
CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

-- Note: bank_details_status and updated_at are set explicitly by app code
-- on every insert/update to keep the data model transparent (no hidden triggers).
