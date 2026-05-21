# Salary Info Collection App — Project Context

**Owner:** privatebrand.data@jsw.in (JSW Private Brand / Packer ops)
**Status:** v1 shipped (2026-05-21). v1.1 backlog in [ROADMAP.md](./ROADMAP.md).
**Repo:** local-only, `D:\Salary Info Collection App` (no GitHub remote).

---

## Problem

JSW operates ~10–50 packer-staffed stores. Packer attrition is high — every month a meaningful percentage of packers turn over, and bank-account details for the new joiners (plus any changes for returning packers) have to be collected before the monthly payout.

Previously this happened in Excel files passed manually between store managers and the central ops admin. Three concrete pains:

1. **Typo-driven payout failures.** A single wrong digit in an account number or IFSC code → ICICI rejects the row, or worse, deposits to a wrong account.
2. **Compilation time.** Consolidating store-by-store sheets into the ICICI bulk-payout file took multiple days every month.
3. **No audit trail.** When a packer claimed wrong payout, there was no record of who entered what.

## Solution

A single-machine web app (Next.js + SQLite, no external services) where:

- **Admin** uploads the monthly packer roster (Excel: `emp_id, name, store_code`). System diffs against the DB, carries forward existing bank details, flags new joiners and movers.
- **Manager** (one login per store) enters/edits bank details for *only* their store's packers. Mobile-first.
- **Validation** at every layer (regex client-side, Zod at API, CHECK constraints in DB) prevents the typo class of failures.
- **Cycle lock** (admin opens/closes per month) prevents accidental retroactive edits to a finalised payout.
- **Audit log** records every change with user + timestamp + old/new value.
- **Bank export** produces a consolidated Excel ready to merge with payroll amounts and upload to ICICI corporate banking.

## Outcomes targeted

| Before | After (v1) |
|---|---|
| Multiple days/month compiling Excels | ~30 min to produce the bank file |
| Typo-driven failed payouts every cycle | Format errors blocked before save |
| No audit trail | Full history per packer per cycle |
| Manual chase for missing data | Manager dashboard shows missing-count at a glance |

## Scale

- 10–50 stores · 100–500 active packers · ~50 logins (1 admin + 1 manager per store)
- Read-light, write-bursts at month start/end
- SQLite + WAL fits comfortably; no need for Postgres until 10× growth

## Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 14 App Router + TypeScript | Single-codebase server + UI |
| Styling | Tailwind | Lightweight, no design-system overhead |
| Database | **SQLite via `node:sqlite`** (Node 24+) | Built-in, zero deps, fits scale |
| Auth | `scrypt` from `node:crypto` + cookie sessions | No external auth provider |
| Excel | SheetJS (`xlsx`) | Parse upload, generate export |
| Unit tests | vitest | Fast, ESM-native |
| E2E tests | Playwright (Chromium) | Driven against isolated test DB on port 3100 |
| Deploy | Local `npm run start` (port 3000) or `start-app.bat` (zero-terminal) | No cloud dependency |

## Constraints

- **No external services.** No Supabase, no auth provider, no telemetry — was originally drafted with Supabase, switched to SQLite to remove cloud dependency.
- **No GitHub remote.** Source lives only on the user's machine + this repo.
- **Windows-friendly setup.** `start-app.bat` for non-technical operators.
- **Mobile-first manager UI** (store managers work from phones).

## Non-goals (v1)

Packer-facing UI (no SMS/OTP), salary calculation, notifications, native mobile app, multi-language, 2FA, manager self-service password reset.

---

## Reference docs

- Design spec: `C:/Users/2750834/.claude/plans/i-want-to-create-hidden-glade.md`
- README: [`../README.md`](../README.md)
- Manual UAT tracker: [`../docs/UAT.md`](../docs/UAT.md)
- This file: project context for any future GSD workflow
- Forward-looking work: [`./ROADMAP.md`](./ROADMAP.md)
- Live project state: [`./STATE.md`](./STATE.md)
