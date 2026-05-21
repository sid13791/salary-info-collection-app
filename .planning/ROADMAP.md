# Roadmap: Salary Info Collection App

## Overview

Replace JSW's manual Excel-based packer bank-detail collection with a self-hosted
web app. Milestone v1 (Phases 1–3) shipped 2026-05-21 — admin/manager flows, roster
diff, audit log, bank export, Playwright E2E. Milestone v1.1 (Phases 4–8) hardens
the app for ongoing monthly use: manager self-service, native ICICI export, backups,
audit CSV, coverage gate.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Next.js + SQLite + auth + schema scaffold
- [x] **Phase 2: Core flows** - Cycle open/close, roster upload + diff, packer add, manager edit, bank export
- [x] **Phase 3: Polish & launch enablers** - Stores UI, admin parity with managers, cycle dropdown + reopen, zero-terminal launcher, Playwright E2E
- [ ] **Phase 4: Manager self-service password change** - Let managers reset their own password without admin
- [ ] **Phase 5: Native ICICI bulk-payout format** - Export in ICICI's exact NetBanking column layout
- [ ] **Phase 6: Scheduled SQLite backups** - Daily snapshot of app.db to backups/ with 30-day retention
- [ ] **Phase 7: Audit log CSV export** - Download filtered audit log as CSV for compliance
- [ ] **Phase 8: Test coverage gate** - Add coverage reporting + 80% threshold across vitest and Playwright

## Phase Details

### Phase 1: Foundation
**Goal**: Working Next.js + SQLite + auth + schema scaffold that can run locally.
**Depends on**: Nothing (first phase)
**Requirements**: R-AUTH-1, R-AUTH-4, R-SEC-1, R-SEC-2, R-OPS-1, R-OPS-2
**Success Criteria** (what must be TRUE):
  1. Visiting `/` redirects to `/login`
  2. Login with admin credentials lands on `/admin`
  3. `./data/app.db` exists with full schema after `npm run db:init`
  4. Typecheck + unit tests pass
**Plans**: retroactive (delivered)

### Phase 2: Core flows
**Goal**: All in-app workflows for collecting bank details work end-to-end against a real DB.
**Depends on**: Phase 1
**Requirements**: R-CYCLE-1, R-CYCLE-2, R-CYCLE-4, R-ROSTER-1, R-ROSTER-2, R-ROSTER-3, R-ROSTER-4, R-PACKER-3, R-PACKER-4, R-EXPORT-1, R-EXPORT-2, R-AUDIT-1, R-AUDIT-2, R-VAL-1, R-VAL-2, R-VAL-3
**Success Criteria** (what must be TRUE):
  1. Admin can open a cycle, upload a roster Excel, see diff preview, commit
  2. Manager only sees their own store's packers and can edit them when cycle is open
  3. Closing a cycle blocks manager edits
  4. Bank export downloads as `.xlsx` with all active packers and blank amount column
  5. Every bank-detail change appears in `/admin/audit`
**Plans**: retroactive (delivered)

### Phase 3: Polish & launch enablers
**Goal**: Non-technical operator can run, use, and maintain the app without a developer.
**Depends on**: Phase 2
**Requirements**: R-STORE-2, R-PACKER-5, R-CYCLE-3, R-OPS-3, R-Q-1, R-Q-2
**Success Criteria** (what must be TRUE):
  1. `start-app.bat` boots the app and opens the browser with no prior setup
  2. Admin can add stores via UI and drill into any store to edit packers
  3. Reopening a previously closed month works (UNIQUE constraint handled gracefully)
  4. Cycle is picked via Month + Year dropdown, not free-text
  5. All 12 Playwright E2E tests pass on every run
**Plans**: retroactive (delivered)

### Phase 4: Manager self-service password change
**Goal**: Managers can change their own password without filing an admin ticket.
**Depends on**: Phase 3
**Requirements**: R-AUTH-5
**Success Criteria** (what must be TRUE):
  1. `/manager/account` page exists with change-password form
  2. Manager must enter current password to set a new one
  3. `must_change_password` flag clears after successful change
  4. New E2E test covers the happy path + wrong-current-password rejection
**Plans**: TBD

### Phase 5: Native ICICI bulk-payout format
**Goal**: Admin can download a file that uploads to ICICI corporate banking with zero manual reformatting (except filling Amount).
**Depends on**: Phase 3
**Requirements**: R-EXPORT-4
**Success Criteria** (what must be TRUE):
  1. Export page has a format toggle (Generic vs ICICI)
  2. ICICI format matches the bank's published NetBanking corporate template
  3. Admin still fills Amount column post-download (out of scope)
  4. Unit test verifies column order
**Plans**: TBD

### Phase 6: Scheduled SQLite backups
**Goal**: A failed disk / corrupted DB does not lose more than one day of bank-detail edits.
**Depends on**: Phase 3
**Requirements**: R-OPS-4
**Success Criteria** (what must be TRUE):
  1. `scripts/backup-db.mjs` produces a timestamped consistent backup
  2. Windows Task Scheduler entry runs it daily at 02:00 (documented)
  3. Last 30 backups retained, older ones auto-pruned
  4. `restore-backup.bat` swaps a chosen backup in safely
**Plans**: TBD

### Phase 7: Audit log CSV export
**Goal**: Admin can hand a compliance reviewer a CSV of who-changed-what-when, filtered to a date range or store.
**Depends on**: Phase 3
**Requirements**: R-AUDIT-4
**Success Criteria** (what must be TRUE):
  1. `/admin/audit` has a "Download CSV" button
  2. Download respects current filters (store, packer, date range)
  3. CSV includes: timestamp, user email, packer emp_id, field, old, new
**Plans**: TBD

### Phase 8: Test coverage gate
**Goal**: Any commit that drops coverage below 80% fails before merge.
**Depends on**: Phase 3
**Requirements**: R-Q-3, R-Q-4
**Success Criteria** (what must be TRUE):
  1. `npm run test` reports coverage with `@vitest/coverage-v8`
  2. `npm run test:e2e` reports coverage via Istanbul integration
  3. A single `npm run verify` runs both + the threshold check
  4. README documents the gate
**Plans**: TBD
