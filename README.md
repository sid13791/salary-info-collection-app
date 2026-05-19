# Salary Info Collection App

Web app for collecting packer bank-account details for monthly salary payouts.
Replaces the manual Excel collection process. Designed for a small ops team
(1–few admins, ~50 store managers, 100–500 active packers).

**Stack:** Next.js 14 (App Router) + TypeScript + Tailwind + Supabase (Postgres + Auth + RLS) + SheetJS.

See [the design spec](C:/Users/2750834/.claude/plans/i-want-to-create-hidden-glade.md) for the full design.

---

## What it does

- **Admin** uploads a monthly packer roster (`emp_id, name, store_code` in Excel). The app diffs against the existing DB: matches by `(emp_id, store_id)`, carries forward bank details, adds new joiners, and marks dropped packers inactive.
- **Manager** (one login per store) logs in and fills in `bank_account_no`, `ifsc_code`, and `phone` for each packer in their store. Mobile-first UI.
- **Admin** opens/closes monthly cycles. When the cycle is closed, edits are locked and a snapshot is taken into `cycle_packers`.
- **Admin** downloads a consolidated Excel (`emp_id, name, store, bank_account_no, ifsc_code, phone, amount` — amount column blank) to merge with payroll amounts before uploading to ICICI corporate banking.
- **Full audit log** of every bank-detail change, who and when.

---

## One-time setup

### 1. Create a Supabase project

Go to https://supabase.com → New Project. You need three secrets:

- `Project URL` (e.g. `https://abcxyz.supabase.co`)
- `anon` public key
- `service_role` secret key

### 2. Apply the schema

In the Supabase SQL editor, run these files in order:

1. `db/schema.sql` — tables, indexes, helper functions
2. `db/triggers.sql` — audit trigger on `packers`
3. `db/policies.sql` — Row Level Security
4. `db/seed.sql` — sample stores + packers (edit before running)

### 3. Create the first admin user

Supabase Dashboard → **Authentication → Users → Add user** (email + password).
Then in SQL editor:

```sql
insert into app_users (id, email, role, store_id, must_change_password)
values ('<the-auth-uid-you-just-created>', 'admin@example.com', 'admin', null, true);
```

Managers can be created from the **Managers** screen in the running app after you log in as admin.

### 4. Local env

```bash
cp .env.local.example .env.local
# Fill in the three Supabase values
```

### 5. Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 and log in.

---

## Project layout

```
src/
  app/
    login/                login page + form
    admin/                admin dashboard + sub-pages (roster, export, audit, managers, add-packer)
    manager/              manager dashboard + edit screen (mobile-first)
    api/                  route handlers (cycle, roster, packers, export, managers)
  components/             shared UI (Header, Button, Input, Badge)
  lib/
    supabase/             client/server/service-role wrappers + DB types
    validators.ts         IFSC/account/phone regex + Zod schemas
    roster-diff.ts        pure function: (existing, uploaded) → diff
    excel/                parse-roster.ts, generate-export.ts
    auth.ts               requireUser / requireAdmin / requireManager (server-side)
db/
  schema.sql              tables + indexes
  triggers.sql            audit trigger + status derivation
  policies.sql            RLS policies
  seed.sql                sample data
```

---

## Commands

| Command            | What it does                          |
|--------------------|---------------------------------------|
| `npm run dev`      | Dev server on http://localhost:3000   |
| `npm run build`    | Production build                      |
| `npm run start`    | Run production build                  |
| `npm run typecheck`| TypeScript check (no emit)            |
| `npm run test`     | Run vitest unit tests                 |
| `npm run lint`     | Lint                                  |

---

## Security model

- **All authorization lives in Postgres RLS** (`db/policies.sql`).
  A bug in app code cannot leak one store's data to another store's manager.
- **Managers can only `UPDATE` their own store's packers**, and only when a cycle is `open`.
- **Audit logging is a Postgres trigger** (`SECURITY DEFINER`) — app code cannot bypass it.
- **Format constraints are CHECK constraints** in the DB — even direct SQL injection cannot insert a malformed IFSC.
- **Service-role key** is used only in server-side `/api/*` routes for actions that legitimately need to bypass RLS (admin user creation, cycle close snapshot).
- **No public sign-up.** Admin creates manager logins; managers cannot self-register.

---

## Verification script (manual E2E)

See `docs/superpowers/specs/` (or the design spec) for the 10-step manual test
covering: cycle open, roster upload diff, manual add, manager edit + validation,
RLS isolation, re-upload preserving edits, cycle close + lock, export, audit log,
reopen cycle.

---

## Out of scope (v1)

Packer-facing UI, salary amount calculation, SMS/email notifications, native
mobile app, multi-language, 2FA, manager self-service password reset.
See the design spec for rationale.
