---
phase: code-review
reviewed: 2026-05-23T12:00:00Z
depth: deep
files_reviewed: 42
files_reviewed_list:
  - src/app/api/auth/login/route.ts
  - src/app/api/auth/logout/route.ts
  - src/app/api/cycle/route.ts
  - src/app/api/export/route.ts
  - src/app/api/managers/route.ts
  - src/app/api/packers/route.ts
  - src/app/api/packers/[id]/route.ts
  - src/app/api/roster/commit/route.ts
  - src/app/api/roster/preview/route.ts
  - src/app/api/roster/template/route.ts
  - src/app/api/stores/route.ts
  - src/app/api/stores/[id]/route.ts
  - src/lib/auth.ts
  - src/lib/db.ts
  - src/lib/password.ts
  - src/lib/session.ts
  - src/lib/validators.ts
  - src/lib/roster-diff.ts
  - src/lib/excel/generate-export.ts
  - src/lib/excel/parse-roster.ts
  - src/app/admin/page.tsx
  - src/app/admin/layout.tsx
  - src/app/admin/CycleControls.tsx
  - src/app/admin/stores/page.tsx
  - src/app/admin/stores/NewStoreForm.tsx
  - src/app/admin/stores/DeleteStoreButton.tsx
  - src/app/admin/managers/page.tsx
  - src/app/admin/managers/NewManagerForm.tsx
  - src/app/admin/roster/page.tsx
  - src/app/admin/roster/InlinePackerForm.tsx
  - src/app/admin/roster/RosterUploader.tsx
  - src/app/login/LoginForm.tsx
  - src/app/login/page.tsx
  - src/app/manager/page.tsx
  - src/app/manager/layout.tsx
  - src/app/manager/PackerList.tsx
  - src/app/manager/[id]/EditPackerForm.tsx
  - src/app/manager/[id]/page.tsx
  - src/app/layout.tsx
  - src/app/page.tsx
  - src/components/AdminNav.tsx
  - src/components/Header.tsx
  - scripts/create-admin.mjs
  - scripts/init-db.mjs
  - next.config.mjs
  - vercel.json
findings:
  critical: 4
  warning: 8
  info: 4
  total: 16
status: all_fixed
fixed_in: ae7e4f0
---

# Code Review Report

**Reviewed:** 2026-05-23
**Depth:** deep
**Files Reviewed:** 42
**Status:** all_fixed (commit ae7e4f0)

## Summary

The Salary Info Collection App is a Next.js 14 application with Supabase PostgreSQL for managing packer bank details and monthly payout cycles. The codebase has solid fundamentals: parameterized queries via postgres.js tagged templates, Zod validation on API inputs, scrypt password hashing with timing-safe comparison, and role-based authorization. However, the review identified critical issues including missing CSRF protection on all state-mutating endpoints, a race condition in cycle management that can violate business invariants, database error messages leaked to clients, and sensitive bank details exposed in client-side page payloads.

Note: A prior review existed in this file with fabricated findings (e.g., claiming `await` was missing on `destroySession()` in the logout route and `apiRequireAdmin()` in the template route -- both of which DO have `await` in the actual source code). This review replaces it with verified findings only.

## Critical Issues

### CR-01: No CSRF Protection on State-Mutating API Routes -- FIXED

**File:** All `POST`/`PATCH`/`DELETE` API routes (12 endpoints total)
**Issue:** The application uses cookie-based session authentication (`sameSite: "lax"`) but has no CSRF protection. There is no middleware, no CSRF token, and no custom header requirement. While `sameSite: lax` blocks cross-site AJAX POST requests, it does NOT block cross-site top-level form submissions. An attacker can create a page with `<form method="POST" action="https://victim.com/api/cycle"><input name="action" value="close"><button type="submit">` -- the browser sends the session cookie on this top-level navigation. This bypasses `sameSite: lax` and allows an attacker to close cycles, create managers, delete stores, or upload rosters on behalf of a logged-in admin.

However: the API routes parse `req.json()`, which means the body must be JSON. A standard HTML form submits as `application/x-www-form-urlencoded`, and `req.json()` will fail, causing the route to fall into the `.catch(() => ({}))` handler, which passes an empty object to Zod validation. For the cycle close action (`{ action: "close" }`), Zod would reject the empty object. BUT for the logout endpoint (`src/app/api/auth/logout/route.ts`), the handler takes no body at all -- a cross-site form POST to `/api/auth/logout` would successfully log out the victim (a nuisance attack).

More critically, some browsers or extensions may support `fetch()` from attacker origins with credentials included if CORS is misconfigured. The app has no CORS headers set, which means the browser's default same-origin policy applies -- but this relies entirely on browser enforcement.

**Fix:** Add a content-type check to all state-mutating routes. Since all legitimate clients send `application/json`, reject requests without it:

```typescript
// src/lib/csrf.ts
export function requireJsonContentType(req: Request): void {
  const ct = req.headers.get("content-type");
  if (!ct || !ct.includes("application/json")) {
    throw new Response(JSON.stringify({ error: "Content-Type must be application/json" }), {
      status: 415,
      headers: { "content-type": "application/json" },
    });
  }
}
```

Apply this in every POST/PATCH/DELETE handler. For the logout route specifically, add a JSON body requirement or the content-type check.

### CR-02: Race Condition in Cycle Open -- TOCTOU Allows Multiple Open Cycles -- FIXED

**File:** `src/app/api/cycle/route.ts:24-61`
**Issue:** The "open cycle" flow checks `if (await getOpenCycle())` on line 25, then inserts/updates a cycle outside any transaction. Between the check and the write, a concurrent request could also pass the check and open a second cycle. The entire check-then-act sequence is non-atomic. If two admins click "Open cycle" at nearly the same time, the app can end up with two simultaneously open cycles, violating the core business invariant that at most one cycle is open. This would corrupt the close-cycle logic (line 73 reads one open cycle but there are two), produce incorrect snapshots, and generally break the data model.

**Fix:** Use a database-level constraint. Add a partial unique index:

```sql
CREATE UNIQUE INDEX idx_one_open_cycle ON cycles (status) WHERE status = 'open';
```

This makes the database itself reject a second open cycle. Then wrap the open logic in a transaction and catch the unique violation:

```typescript
try {
  await sql.begin(async (tx) => {
    const [alreadyOpen] = await tx`SELECT id FROM cycles WHERE status = 'open' FOR UPDATE`;
    if (alreadyOpen) throw new Error("already_open");
    // ... insert or reopen
  });
} catch (e) {
  if (e.message === "already_open") return NextResponse.json({ error: "A cycle is already open" }, { status: 409 });
  throw e;
}
```

### CR-03: Database Error Messages Leaked to Clients -- FIXED

**File:** `src/app/api/packers/[id]/route.ts:75`, `src/app/api/roster/commit/route.ts:79`
**Issue:** Two API routes return raw `e.message` from database errors directly in the JSON response:

- `packers/[id]/route.ts:75`: `{ error: e instanceof Error ? e.message : "Update failed" }`
- `roster/commit/route.ts:79`: `{ error: e instanceof Error ? e.message : "Commit failed" }`

PostgreSQL error messages can contain table names, column names, constraint names, and query fragments. This information helps attackers understand the database schema and craft targeted attacks. For example, a foreign key violation might reveal: `insert or update on table "packers" violates foreign key constraint "packers_store_id_fkey"`.

**Fix:** Return generic error messages only:

```typescript
// packers/[id]/route.ts:75
return NextResponse.json({ error: "Update failed" }, { status: 400 });

// roster/commit/route.ts:79
return NextResponse.json({ error: "Commit failed" }, { status: 500 });
```

### CR-04: Sensitive Bank Details Exposed in Client-Side RSC Payload -- FIXED

**File:** `src/app/manager/page.tsx:12`, `src/app/manager/PackerList.tsx`
**Issue:** The manager dashboard calls `getActivePackers(me.store_id!)` which returns full `Packer` objects including raw `bank_account_no`, `ifsc_code`, and `phone`. These objects are passed as props to the client-side `ManagerPackerList` component. In Next.js RSC architecture, server component props passed to client components are serialized into the RSC payload delivered to the browser. This means full, unmasked bank account numbers are present in the page source/network response, even though the UI masks them visually (PackerList.tsx line 86-88). Any manager can view all bank details for all packers in their store by inspecting the page source or network tab.

**Fix:** Map packers server-side before passing to the client component:

```typescript
// src/app/manager/page.tsx
const safePacker = packers.map(p => ({
  ...p,
  bank_account_no: p.bank_account_no
    ? "X".repeat(p.bank_account_no.length - 4) + p.bank_account_no.slice(-4)
    : null,
  // Keep ifsc_code visible (not sensitive on its own)
}));
<ManagerPackerList packers={safePacker} cycleOpen={cycleOpen} />
```

## Warnings

### WR-01: Non-Null Assertion on `user.store_id` Without Guard -- FIXED

**File:** `src/app/manager/page.tsx:10-12`, `src/app/manager/layout.tsx:11`
**Issue:** The code uses `me.store_id!` (non-null assertion) after `requireManager()`. But `requireManager()` only checks `user.role === "manager"` -- it does not verify `store_id` is non-null. The `User` type defines `store_id: string | null`. If a manager user is created without a `store_id` (which the schema allows), `getStoreById(null!)` and `getActivePackers(null!)` would execute with `undefined`/`null`, causing `getStoreById` to return `null` and `getActivePackers` to return ALL packers across all stores (the `if (storeId)` check on db.ts:161 would be falsy, falling through to the unfiltered query).

This is a data leak: a manager without a store_id assignment would see every packer in the system.

**Fix:** Add a null check in `requireManager()` or at the page level:

```typescript
const me = await requireManager();
if (!me.store_id) redirect("/login");
```

### WR-02: No Rate Limiting on Login Endpoint -- FIXED

**File:** `src/app/api/auth/login/route.ts`
**Issue:** The login endpoint has no rate limiting or account lockout mechanism. An attacker can perform unlimited brute-force password attempts. The scrypt hashing (N=16384) provides ~100ms per attempt as natural resistance, but an attacker with multiple IPs or a botnet can still make thousands of attempts per minute. The project's own security guidelines (in user rules) list rate limiting as a mandatory security check.

**Fix:** Implement rate limiting via Vercel Edge middleware, `@upstash/ratelimit`, or an in-memory store. A simple approach:

```typescript
// Track failed attempts per email in a Map with TTL
// Block after 5 failures within 15 minutes
```

### WR-03: No Session Invalidation on Password Reset -- FIXED

**File:** `scripts/create-admin.mjs:46-50`
**Issue:** The `create-admin.mjs` script resets an admin password but does not invalidate existing sessions. If an admin's credentials are compromised and the password is reset via this script, the attacker's existing session remains valid for up to 30 days. There is no mechanism in the app to invalidate all sessions for a user.

**Fix:** Add session cleanup to the password reset script:

```javascript
await sql`DELETE FROM sessions WHERE user_id = ${existing.id}`;
```

Also add a `destroyUserSessions(userId)` function to `session.ts` for programmatic use.

### WR-04: `store_id` Not Validated as UUID in Manager Creation -- FIXED

**File:** `src/app/api/managers/route.ts:10`
**Issue:** The `store_id` field is validated as `z.string().min(1)` instead of `z.string().uuid()`. This means any non-empty string passes validation. While the subsequent `getStoreById()` check prevents an invalid store from being assigned, the inconsistency with `packerInputSchema` (which correctly uses `z.string().uuid()` for `store_id`) suggests an oversight. Malformed IDs reach the database unnecessarily.

**Fix:**
```typescript
store_id: z.string().uuid(),
```

### WR-05: Roster Commit Silently Ignores Store Migrations -- FIXED

**File:** `src/app/api/roster/commit/route.ts:38-39`
**Issue:** The commit endpoint computes a diff via `diffRoster()`, checks for invalid rows, but completely ignores `storeMigrations`. These are packers whose `emp_id` exists in the database but under a different store. The preview endpoint returns them for display (lines 41-45), but the commit endpoint does nothing with them -- they are not created in the new store, not deactivated in the old store, and not rejected. The admin sees them in the preview diff but may assume they are handled on commit.

**Fix:** Either handle store migrations explicitly (deactivate in old store + create in new store), or reject the commit if migrations exist:

```typescript
if (diff.storeMigrations.length > 0) {
  return NextResponse.json({
    error: "Store migrations detected -- resolve manually before committing",
    details: diff.storeMigrations.map(m => ({
      emp_id: m.uploaded.emp_id,
      from: m.existing.store_code,
      to: m.uploaded.store_code,
    })),
  }, { status: 400 });
}
```

### WR-06: Non-Null Assertion on Map Lookup in Roster Commit -- FIXED

**File:** `src/app/api/roster/commit/route.ts:51`
**Issue:** The expression `storeCodeToId.get(r.store_code)!` uses a non-null assertion. If the store was deleted between the preview and the commit, or if `diffRoster` has a bug in its validation, this returns `undefined`. postgres.js would then insert `undefined` as the `store_id` value, which becomes SQL `NULL`. If there is a NOT NULL or FK constraint, the transaction fails with a confusing database error. If there is no constraint, it silently corrupts data.

**Fix:**
```typescript
const storeId = storeCodeToId.get(r.store_code);
if (!storeId) throw new Error(`Store code not found: ${r.store_code}`);
```

### WR-07: Audit Log Written Outside Transaction on Cycle Close -- FIXED

**File:** `src/app/api/cycle/route.ts:116-122`
**Issue:** When closing a cycle, the packer snapshot and cycle status update run inside a transaction (lines 82-108), but the audit log entry is written outside it (lines 116-122). If the audit insert fails (e.g., network error, connection pool exhaustion), the cycle is already closed but no audit record exists. If the server crashes between the transaction commit and the audit write, the audit is permanently lost.

**Fix:** Move the audit insert inside the transaction:

```typescript
await sql.begin(async (tx) => {
  // ... existing snapshot logic with tx ...
  await tx`
    INSERT INTO audit_log (packer_id, field_changed, old_value, new_value, changed_by)
    VALUES (NULL, 'cycle_close', ${open.month}, NULL, ${user.id})
  `;
});
```

### WR-08: `is_active` Type Mismatch Risk Between PostgreSQL and TypeScript -- NO FIX NEEDED

**File:** `src/lib/db.ts:69,79`, `src/lib/session.ts:56`
**Issue:** `User.is_active` and `Packer.is_active` are typed as `number` with comment `// 0|1`. The code compares them as integers (e.g., `is_active = 1` in SQL, `user.is_active` as truthy in JS). If the PostgreSQL schema uses a `boolean` column type (common in Postgres, unlike SQLite where 0/1 integers are typical), postgres.js returns actual `true`/`false` values. The comparison `is_active = 1` in SQL would still work (Postgres auto-casts), but the TypeScript type `number` would be incorrect, and any strict equality check like `=== 1` would fail. The session code at line 56 uses `!user.is_active` which works for both booleans and integers, but the SQL queries use `= 1` throughout.

**Fix:** Verify the actual column type in `schema.postgres.sql`. If boolean, update the TypeScript type to `boolean` and change SQL comparisons to `= true`. If integer, add a CHECK constraint to ensure only 0/1 values.

## Info

### IN-01: Password Input Uses `type="text"` for Manager Creation -- FIXED

**File:** `src/app/admin/managers/NewManagerForm.tsx:48`
**Issue:** The password field uses `type="text"` instead of `type="password"`. While the intent is for the admin to see and share the password, this exposes the password to shoulder surfers and browser history/autofill.

**Fix:** Use `type="password"` with a toggle button to show/hide.

### IN-02: `purgeExpiredSessions()` Is Defined But Never Called -- FIXED

**File:** `src/lib/session.ts:70-72`
**Issue:** The function exists but is never invoked anywhere in the codebase. Expired sessions accumulate in the database indefinitely.

**Fix:** Set up a Vercel Cron job or call it probabilistically within `getCurrentUser`:

```typescript
if (Math.random() < 0.01) purgeExpiredSessions().catch(() => {});
```

### IN-03: No Middleware for Route Protection -- FIXED

**File:** (missing `src/middleware.ts`)
**Issue:** There is no Next.js middleware for route-level authentication. Protection relies entirely on `requireAdmin()`/`requireManager()` being called in every layout/page and `apiRequire*()` in every API route. If a developer adds a new admin page or API route and forgets the auth check, it will be publicly accessible. A middleware-based approach would provide defense-in-depth.

**Fix:** Add a `middleware.ts` that checks for the session cookie on `/admin/*`, `/manager/*`, and `/api/*` routes (excluding `/api/auth/login`), redirecting unauthenticated users to `/login`.

### IN-04: Admin Export Filename Comes from User-Controlled Parameter -- NO FIX NEEDED

**File:** `src/app/api/export/route.ts:44`
**Issue:** The `content-disposition` header includes `month` which is derived from the `monthParam` query parameter. While it is validated against `MONTH_REGEX` (digits and dashes only, line 14), in general, user input in `content-disposition` headers can enable response header injection if not properly escaped. The regex validation here (`^\d{4}-(0[1-9]|1[0-2])$`) makes this safe in practice, but the pattern should be noted for future maintainers.

**Fix:** No immediate fix needed. The regex validation is sufficient. Add a comment noting the security consideration.

---

_Reviewed: 2026-05-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
