# Salary Info Collection App

Web app for collecting packer bank-account details for monthly salary payouts.
Replaces the manual Excel collection process for a small ops team (1–few admins,
~50 store managers, 100–500 active packers).

**Stack:** Next.js 14 (App Router) + TypeScript + Tailwind + **SQLite (node:sqlite, built-in)** + SheetJS.
Zero external services. Runs entirely on a single machine or server.

> Design spec: `C:/Users/2750834/.claude/plans/i-want-to-create-hidden-glade.md`

---

## What it does

- **Admin** uploads a monthly packer roster (`emp_id, name, store_code` in Excel). The app diffs against the DB — matches by `(emp_id, store_id)`, carries forward bank details, adds new joiners, marks dropped packers inactive.
- **Manager** (one login per store) logs in and fills `bank_account_no`, `ifsc_code`, `phone` for each packer in their store. Mobile-first UI.
- **Admin** opens/closes monthly cycles. When closed, edits lock and a snapshot is written into `cycle_packers`.
- **Admin** downloads a consolidated Excel (`emp_id, name, store, bank_account_no, ifsc_code, phone, amount` — amount blank) to merge with payroll before uploading to ICICI corporate banking.
- **Full audit log** of every bank-detail change with who and when.

---

## Setup (3 commands)

Requires **Node 24+** (for built-in `node:sqlite`).

```bash
npm install
npm run db:init                              # creates ./data/app.db + 2 sample stores + 5 demo packers + opens current cycle
npm run db:create-admin -- admin@example.com mySecretPw123
```

Then:

```bash
npm run dev
```

Open http://localhost:3000 and sign in.

The whole app — database, sessions, password hashing, Excel parsing/generation —
runs in one Node process. No external service needed.

---

## Creating manager logins

1. Log in as admin → **Managers** → fill email + temp password + pick a store
2. Share those credentials with the store manager
3. They sign in at the same URL and see only their store's packers

---

## Where data lives

- **`./data/app.db`** — SQLite database file. Git-ignored. Back this up.
- WAL files (`app.db-wal`, `app.db-shm`) — created by SQLite during use, also git-ignored.
- Set `SALARY_DB_PATH` env var to move the DB elsewhere (e.g. a network drive for shared backups).

---

## Project layout

```
src/
  app/
    login/                login page + form
    admin/                dashboard + roster + export + audit + managers + add-packer
    manager/              dashboard + edit screen (mobile-first)
    api/                  route handlers (auth, cycle, roster, packers, export, managers)
  components/             shared UI (Header, Button, Input, Badge)
  lib/
    db.ts                 node:sqlite singleton + typed query helpers
    session.ts            cookie-based sessions backed by sessions table
    password.ts           scrypt hash/verify (no external deps)
    auth.ts               requireUser / requireAdmin / requireManager guards
    validators.ts         IFSC / account / phone regex + Zod schemas
    roster-diff.ts        pure function: (existing, uploaded) → diff
    excel/                parse-roster.ts, generate-export.ts
db/
  schema.sql              tables, indexes, CHECK constraints
scripts/
  init-db.mjs             apply schema + seed sample data
  create-admin.mjs        create or reset an admin password
```

---

## Commands

| Command                                       | What it does                                |
|-----------------------------------------------|---------------------------------------------|
| `npm run dev`                                 | Dev server on http://localhost:3000         |
| `npm run build`                               | Production build                            |
| `npm run start`                               | Run production build                        |
| `npm run typecheck`                           | TypeScript check                            |
| `npm run test`                                | vitest unit tests                           |
| `npm run db:init`                             | Apply schema, seed sample data              |
| `npm run db:create-admin -- email password`   | Create or reset an admin user               |

---

## Security model

- **Password hashing:** `scrypt` from `node:crypto` (memory-hard, no external dep).
- **Sessions:** opaque random tokens (32 bytes, `httpOnly` cookie), backed by a `sessions` table with a 30-day expiry. Logout deletes the row.
- **Authorization:** enforced in route handlers + page guards. Managers can only `SELECT/UPDATE` packers where `store_id = me.store_id` AND a cycle is `open`. Admin overrides apply.
- **DB-level integrity:** `CHECK` constraints on `packers` reject malformed IFSC / account / phone even if the app code is bypassed.
- **No public sign-up.** Only admin creates manager logins.
- **No external services.** No Supabase, no auth provider, no telemetry.

---

## Verification (manual E2E)

1. `npm run db:init && npm run db:create-admin -- admin@example.com pw12345678 && npm run dev`
2. Log in as `admin@example.com` → dashboard shows 2 sample stores, 5 packers, cycle OPEN
3. **Managers** → create `mgr.ncr@example.com / pw12345678` for NCR01
4. Sign out, sign in as the manager → see only NCR01 packers (3 sample) → tap one → fill bank details → save → status flips to *Provided*
5. Sign out, sign in as admin → **Upload roster** → upload an Excel with mixed new/existing emp_ids → diff preview shows correct counts → confirm → manager edits preserved
6. **+ Add packer** → manually add one → appears immediately
7. Close cycle → manager edit save now blocked
8. **Download bank export** → opens in Excel with all active packers + blank amount column
9. **Audit log** → every edit attributed to the right user with old → new values
10. Open a new cycle for next month → repeat

---

## Out of scope (v1)

Packer-facing UI, salary amount calculation, SMS/email notifications, native mobile app, multi-language, 2FA, manager self-service password reset, multi-user simultaneous editing of the same packer (last write wins). See the design spec for rationale.
