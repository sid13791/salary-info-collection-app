# Requirements — Salary Info Collection App

Derived from the design spec (`C:/Users/2750834/.claude/plans/i-want-to-create-hidden-glade.md`)
and the shipped v1 codebase. Requirements are tagged `[v1 ✅]` (already delivered)
or `[v1.1]` (forward-looking, see ROADMAP).

---

## Functional

### Roles & auth
- **R-AUTH-1** [v1 ✅] Two roles: `admin` and `manager`. No public sign-up.
- **R-AUTH-2** [v1 ✅] Admin creates manager logins (email + temp password + store assignment) via UI.
- **R-AUTH-3** [v1 ✅] Each manager is bound to exactly one store.
- **R-AUTH-4** [v1 ✅] Session = opaque cookie token, 30-day expiry, backed by `sessions` table.
- **R-AUTH-5** [v1.1] Manager self-service password change (not just admin reset).
- **R-AUTH-6** [v1.1] 2FA for admin.

### Stores
- **R-STORE-1** [v1 ✅] Stores have `code` (unique, used in roster Excel) + `name` (friendly label).
- **R-STORE-2** [v1 ✅] Admin can add stores via UI (`/admin/stores`).
- **R-STORE-3** [v1.1] Admin can rename a store (carry-over old code as alias).
- **R-STORE-4** [v1.1] Admin can mark a store inactive (no new rosters, existing data preserved).

### Packers
- **R-PACKER-1** [v1 ✅] Packer = `(emp_id, name, store_id, bank_account_no, ifsc_code, phone, is_active, bank_details_status)`.
- **R-PACKER-2** [v1 ✅] `(emp_id, store_id)` uniqueness — same emp_id may exist in different stores.
- **R-PACKER-3** [v1 ✅] Admin can add a packer manually via UI.
- **R-PACKER-4** [v1 ✅] Manager can edit bank details for packers in their store, ONLY when a cycle is open.
- **R-PACKER-5** [v1 ✅] Admin can edit any packer's bank details regardless of store, regardless of cycle status (with visible warning when closed).

### Monthly cycles
- **R-CYCLE-1** [v1 ✅] Cycle = `(month YYYY-MM, status: open|closed)`. Only one cycle open at a time.
- **R-CYCLE-2** [v1 ✅] Admin opens cycle via Month + Year dropdown.
- **R-CYCLE-3** [v1 ✅] Opening a cycle for a month with an existing closed cycle reopens it (preserves history).
- **R-CYCLE-4** [v1 ✅] Admin closes cycle → snapshot of all active packers written to `cycle_packers` → all manager edits blocked.
- **R-CYCLE-5** [v1.1] Auto-close cycle on a configurable cutoff date.

### Roster upload (Excel)
- **R-ROSTER-1** [v1 ✅] Admin uploads `.xlsx` with columns `emp_id, name, store_code`.
- **R-ROSTER-2** [v1 ✅] System computes diff: matched (carry forward), new (add with status=missing), reactivated (was inactive, now back), deactivated (in DB, missing from upload), store-migration (emp_id moved to another store), invalid rows (missing fields / unknown store_code / duplicates).
- **R-ROSTER-3** [v1 ✅] Admin sees diff preview before committing. Invalid rows block commit.
- **R-ROSTER-4** [v1 ✅] On commit, bank details on matched packers are preserved.

### Export
- **R-EXPORT-1** [v1 ✅] Admin downloads bank export Excel: `emp_id, name, store, bank_account_no, ifsc_code, phone, amount`.
- **R-EXPORT-2** [v1 ✅] `amount` column is intentionally blank — admin merges with payroll before ICICI upload.
- **R-EXPORT-3** [v1 ✅] Export reflects latest closed cycle's snapshot if one exists, else current live data.
- **R-EXPORT-4** [v1.1] Native ICICI bulk-payout format (current export is generic — admin maps columns post-download).
- **R-EXPORT-5** [v1.1] Full database backup export (multi-sheet xlsx) for offline archive.

### Audit
- **R-AUDIT-1** [v1 ✅] Every bank-detail edit logged with user, timestamp, field, old value, new value.
- **R-AUDIT-2** [v1 ✅] Cycle open / close / reopen / roster upload events logged.
- **R-AUDIT-3** [v1 ✅] Admin can view full audit log with packer/store filter.
- **R-AUDIT-4** [v1.1] Export audit log as CSV for compliance.

---

## Non-functional

### Validation
- **R-VAL-1** [v1 ✅] IFSC: `^[A-Z]{4}0[A-Z0-9]{6}$` — enforced client, API, and DB CHECK constraint.
- **R-VAL-2** [v1 ✅] Bank account: 9–18 digits.
- **R-VAL-3** [v1 ✅] Phone: exactly 10 digits.
- **R-VAL-4** [v1 ✅] Manager edit form requires re-entering the account number (typo guard).

### Security
- **R-SEC-1** [v1 ✅] Password hash: `scrypt` (N=16384) with 16-byte random salt.
- **R-SEC-2** [v1 ✅] Session cookie httpOnly + secure-context-friendly.
- **R-SEC-3** [v1 ✅] DB-level CHECK constraints prevent malformed values even if API is bypassed.
- **R-SEC-4** [v1 ✅] Authorization enforced in API route handlers AND page guards (defence in depth).
- **R-SEC-5** [v1.1] CSRF token on state-changing requests (acceptable now: same-origin only, no API consumers).

### Quality
- **R-Q-1** [v1 ✅] Unit tests (vitest) for validators and roster-diff. 21/21 passing.
- **R-Q-2** [v1 ✅] E2E tests (Playwright) for auth, admin flows, manager edit. 12/12 passing.
- **R-Q-3** [v1.1] CI/CD pipeline that runs tests on every commit (currently manual).
- **R-Q-4** [v1.1] Test coverage report + 80% threshold gate.

### Operational
- **R-OPS-1** [v1 ✅] Single-process Node app — no external services to manage.
- **R-OPS-2** [v1 ✅] SQLite file at `./data/app.db` (configurable via `SALARY_DB_PATH`).
- **R-OPS-3** [v1 ✅] Zero-terminal launcher (`start-app.bat`) for non-technical operators.
- **R-OPS-4** [v1.1] Scheduled SQLite backup-to-disk (e.g. daily snapshot to a backups/ folder).
- **R-OPS-5** [v1.1] Health-check endpoint for external monitoring.
