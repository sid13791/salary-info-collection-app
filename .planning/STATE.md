# Project State

**Last updated:** 2026-05-21
**Active milestone:** v1.1
**Active phase:** none — Phase 4 is next when picked up

## Where we are

v1 is shipped and running locally. Three commits in `master`:

```
e44938c  Add Playwright E2E suite — 12 tests covering auth, admin, manager flows
a2c3f66  Add stores UI, admin packer-edit flow, cycle dropdown + reopen, no-terminal launcher
d76441e  Switch from Supabase to local SQLite (node:sqlite) — no external services
f8bda9a  Initial scaffold: salary info collection app
```

(Plus this GSD bootstrap commit immediately after.)

## What works

- Login (admin + manager)
- Admin: open/close/reopen cycles, upload roster with diff preview, add packer manually, manage managers, manage stores, drill into any store, edit any packer's bank details, download bank export Excel, view audit log
- Manager: see only own store, edit packer bank details, search/filter list, mobile-first

## What's tested

- **21/21 unit tests** (vitest) — validators (IFSC, account, phone regex + normalization) + roster-diff (matched/new/reactivated/deactivated/migrations/invalid)
- **12/12 E2E tests** (Playwright on isolated test DB) — auth/RBAC, admin flows, manager edit + validation gates

## Known caveats

- `node:sqlite` is marked experimental in Node 24 — shows a warning on stdout, works fine. Will graduate to stable in a future Node release.
- LF/CRLF line-ending warnings on Windows commits — cosmetic, doesn't break anything.
- No remote git push set up by design (local-only).

## Open questions

- Will the operator actually run UAT before declaring v1 fully done? (`docs/UAT.md` is scaffolded but not filled in.)
- Which v1.1 phase to prioritise first? Roadmap order is a guess — re-rank when usage feedback arrives.
