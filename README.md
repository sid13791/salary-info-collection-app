# Salary Info Collection App

Web app for collecting packer bank-account details for monthly salary payouts.
Replaces the manual Excel collection process for a small ops team (1–few admins,
~50 store managers, 100–500 active packers).

**Stack:** Next.js 14 (App Router) + TypeScript + Tailwind + **Supabase PostgreSQL** + SheetJS.
Deployed on **Vercel** (auto-deploys from `origin/main`).

---

## What it does

- **Admin** uploads a monthly packer roster (`emp_id, name, store_code` in Excel). The app diffs against the DB — matches by `(emp_id, store_id)`, carries forward bank details, adds new joiners, marks dropped packers inactive.
- **Admin** can also do everything a manager can — drill into any store, edit any packer's bank details (including out of cycle, with a visible warning), add a packer manually, manage stores and manager logins.
- **Manager** (one login per store) logs in and fills `bank_account_no`, `ifsc_code`, `phone` for each packer in their store. Mobile-first UI.
- **Cycles** open/close per month via a Month + Year dropdown. Reopening a previously closed month is one click — bank details and audit history are preserved.
- **Bank export** — admin downloads a consolidated Excel (`emp_id, name, store, bank_account_no, ifsc_code, phone, amount` — amount blank) to merge with payroll before uploading to ICICI corporate banking.
- **Full audit log** of every bank-detail change with who and when.

---

## Quick start

### Production (Vercel)

The app is deployed on Vercel and auto-deploys when code is pushed to `origin/main`.
Production URL is provided by Vercel.

### Local development

Requires **Node 18+**.

1. Copy `.env.local.example` to `.env.local` and set `DATABASE_URL` (Supabase connection pooler) and `DATABASE_URL_DIRECT` (direct connection for scripts).
2. Run:

```bash
npm install
npm run db:init                                       # applies schema to Supabase
npm run db:create-admin -- admin@example.com mySecretPw123
npm run dev                                           # http://localhost:3000
```

Helpers:
- `reset-admin-password.bat` — interactively reset an admin password

---

## Creating logins

### Admin
- First admin: via `npm run db:create-admin -- email password` (or the launcher's first-run prompt).
- Additional admins: same command with a different email. Existing emails get their password reset.

### Managers
1. Log in as admin → **Managers** → fill email + temp password + pick a store → Create.
2. Share the credentials with the store manager.
3. They sign in at the same URL and see only their store's packers.

### Stores
- **Stores** → fill code + name → Add. Code (`NCR01`, `MUM02`) is the value used in the roster Excel; name is the friendly label.

---

## Where data lives

- **Supabase PostgreSQL** — all data lives in the hosted Supabase database. Connection details are in `.env.local`.
- Schema is defined in `db/schema.postgres.sql`.

---

## Project layout

```
src/
  app/
    login/                                        login page + form
    admin/
      page.tsx                                    dashboard
      CycleControls.tsx                           Month/Year dropdown + open/close/reopen
      stores/                                     list + add stores
        [id]/                                     store detail (packer list, admin scope)
          packers/[packerId]/                     admin edit bank details for any packer
      managers/                                   create/list manager logins
      packers/new/                                manual add packer
      roster/                                     Excel upload with diff preview
      export/                                     trigger bank export download
      audit/                                      audit log table
      api/                                        cycle, roster, packers, export, managers, stores
    manager/                                      mobile-first list + edit (reused by admin store-detail page)
  components/                                     shared UI (Header, Button, Input, Badge)
  lib/
    db.ts                                         postgres.js client + typed query helpers
    session.ts                                    cookie-based sessions backed by sessions table
    password.ts                                   scrypt hash/verify
    auth.ts                                       requireUser / requireAdmin / requireManager guards
    validators.ts                                 IFSC / account / phone regex + Zod schemas
    roster-diff.ts                                pure function: (existing, uploaded) → diff
    excel/                                        parse-roster.ts, generate-export.ts
  middleware.ts                                    defense-in-depth auth check for /admin, /manager, /api
  lib/
    csrf.ts                                       content-type enforcement (CSRF protection)
db/
  schema.postgres.sql                             tables, indexes, CHECK constraints (Supabase)
scripts/
  init-db.mjs                                     apply schema to Supabase
  create-admin.mjs                                create or reset an admin password (invalidates sessions)
docs/
  UAT.md                                          manual user-acceptance test tracker
start-app.bat / stop-app.bat / reset-admin-password.bat
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
| `npm run db:init`                             | Apply schema to Supabase                    |
| `npm run db:create-admin -- email password`   | Create or reset an admin user               |

---

## Security model

- **Password hashing:** `scrypt` from `node:crypto` (memory-hard, no external dep).
- **Sessions:** opaque random tokens (32 bytes, `httpOnly` cookie), backed by a `sessions` table with a 30-day expiry. Logout deletes the row. Expired sessions are purged probabilistically.
- **CSRF protection:** all state-mutating API routes require `Content-Type: application/json`, blocking cross-site form submissions.
- **Rate limiting:** login endpoint blocks after 5 failed attempts per email within 15 minutes.
- **Middleware:** Next.js middleware provides defense-in-depth auth checks on `/admin/*`, `/manager/*`, and `/api/*` routes before individual page/route guards execute.
- **Authorization:** enforced in route handlers + page guards.
  - Managers can only `SELECT/UPDATE` packers where `store_id = me.store_id` AND a cycle is `open`.
  - Admins bypass both checks but every change is still audit-logged with their user ID.
- **Bank data masking:** bank account numbers are masked server-side before being passed to client components. Full details are only accessible through the export endpoint.
- **DB-level integrity:** `CHECK` constraints on `packers` reject malformed IFSC / account / phone even if the app code is bypassed. A partial unique index ensures only one cycle can be open at a time.
- **Password reset:** resetting an admin password via `create-admin.mjs` invalidates all existing sessions for that user.
- **No public sign-up.** Only admin creates manager logins.

---

## Verification (manual E2E)

The full UAT script with current results lives at [`docs/UAT.md`](docs/UAT.md). Summary:

1. Open `start-app.bat` (or `npm run dev`), sign in as admin
2. Open a cycle via the Month/Year dropdown (or reopen a closed month — same click)
3. Click any store on the dashboard → packer list → tap a packer → fill bank details → save
4. Create a manager via **Managers**, sign out, sign back in as that manager → confirm they only see their store
5. Upload a roster Excel → diff preview shows matched/new/deactivated/migrations → commit → earlier bank edits preserved
6. Add a packer manually via **+ Add packer**
7. Close cycle → manager edit save now blocked → reopen for next month
8. Download bank export → opens in Excel with all active packers + blank amount column
9. Audit log → every edit attributed to the right user with old → new values

---

## Out of scope (v1)

Packer-facing UI, salary amount calculation, SMS/email/WhatsApp notifications, native mobile app, multi-language, 2FA, manager self-service password reset, multi-user simultaneous editing of the same packer (last write wins).
