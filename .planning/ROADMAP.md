# Roadmap — Salary Info Collection App

**Current milestone:** v1.1 (post-launch hardening + deferred features)
**v1 status:** shipped 2026-05-21 (Phases 1–3 retroactively closed below).

This roadmap is the source of truth for phase management going forward. Use:
- `/gsd-phase <description>` — add a new integer phase
- `/gsd-phase --insert <after-N> <description>` — squeeze in urgent decimal phase (e.g. 4.1)
- `/gsd-phase --edit <N>` — change an existing phase
- `/gsd-phase --remove <N>` — drop a future phase

---

## Milestone v1 — Initial Release ✅ COMPLETE

### Phase 1 — Foundation [✅ done]
**Goal:** Working Next.js + SQLite + auth + schema scaffold.
**Delivered:** Schema (`db/schema.sql`), session/password layer (`src/lib/{db,session,password,auth}.ts`), login screen, role-based redirects, middleware, init/create-admin scripts.
**Verification:** 21 unit tests, typecheck + build green.

### Phase 2 — Core flows [✅ done]
**Goal:** Cycle open/close, roster upload + diff, packer add, manager dashboard, bank export.
**Delivered:** All admin pages (`/admin/{,roster,packers/new,export,managers,audit,stores}`), manager mobile-first list + edit, all API routes.
**Verification:** Manual click-through against verification script in README.

### Phase 3 — Polish & launch enablers [✅ done]
**Goal:** Make it usable by non-technical staff.
**Delivered:** Stores admin UI, admin parity with managers (drill into stores → edit packers), Month/Year cycle dropdown, reopen-cycle flow, `start-app.bat` zero-terminal launcher, Playwright E2E (12 tests), full README + UAT tracker.
**Verification:** 12 E2E tests green.

---

## Milestone v1.1 — Hardening & Deferred Features 📋 PLANNED

Phases below are unstarted. Numbers continue from Phase 3.

### Phase 4 — Manager self-service password change
**Goal:** Let managers change their own password without admin intervention.
**Scope:** Add `/manager/account` page with change-password form. Re-auth required (verify current password). Update `must_change_password` flag accordingly.
**Files (new):** `src/app/manager/account/page.tsx`, `src/app/api/auth/change-password/route.ts`
**Effort:** ~½ day. Requirement: `R-AUTH-5`.

### Phase 5 — Native ICICI bulk-payout format
**Goal:** Export the bank file in ICICI's exact column layout so admin can upload directly without reformatting.
**Scope:** Add `lib/excel/generate-icici-export.ts` matching ICICI's NetBanking corporate template (debit account, beneficiary name, IFSC, account, amount, narration, transaction date). Admin still fills `amount` column post-export — that doesn't change.
**Files (new):** export template generator + admin toggle (generic vs ICICI format).
**Effort:** ~½ day, mostly column-mapping research. Requirement: `R-EXPORT-4`.

### Phase 6 — Scheduled SQLite backups
**Goal:** Daily snapshot of `./data/app.db` to a `./backups/` folder, keep last 30 days.
**Scope:** Add a small Node script triggered by Windows Task Scheduler (or cron on Linux). Snapshot via `sqlite3 .backup` to ensure consistency. Provide `restore-backup.bat`.
**Files (new):** `scripts/backup-db.mjs`, `restore-backup.bat`, README ops section update.
**Effort:** ~½ day. Requirement: `R-OPS-4`.

### Phase 7 — Audit log CSV export
**Goal:** Admin downloads filtered audit log as CSV for compliance reviews.
**Scope:** Add a "Download CSV" button to `/admin/audit` that respects current filters. Reuse SheetJS.
**Files (new):** `src/app/api/audit/export/route.ts`
**Effort:** ~2 hours. Requirement: `R-AUDIT-4`.

### Phase 8 — Test coverage gate
**Goal:** Add coverage reporting + 80% threshold to vitest/Playwright runs.
**Scope:** Add `@vitest/coverage-v8`, configure threshold in `vitest.config.ts`, integrate Playwright coverage via Istanbul. Wire into a single `npm run verify` script.
**Effort:** ~½ day. Requirement: `R-Q-3`, `R-Q-4`.

---

## Backlog (unscheduled — promote to phase when needed)

- Auto-close cycle on configurable cutoff date (`R-CYCLE-5`)
- Store rename with code alias (`R-STORE-3`)
- Store deactivation (`R-STORE-4`)
- 2FA for admin (`R-AUTH-6`)
- CSRF token on state-changing requests (`R-SEC-5`)
- Full database backup export multi-sheet xlsx (`R-EXPORT-5`)
- Health-check endpoint (`R-OPS-5`)
- Per-store dashboards with monthly trend (packers added/removed over time)
- Notification on cycle close (email admin a confirmation with export attached)
