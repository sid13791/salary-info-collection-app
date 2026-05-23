---
reviewed: 2026-05-23T12:00:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - src/app/admin/page.tsx
  - src/app/admin/layout.tsx
  - src/app/admin/CycleControls.tsx
  - src/app/admin/audit/page.tsx
  - src/app/admin/export/page.tsx
  - src/app/admin/history/page.tsx
  - src/app/admin/history/[month]/page.tsx
  - src/app/admin/managers/page.tsx
  - src/app/admin/managers/NewManagerForm.tsx
  - src/app/admin/packers/new/page.tsx
  - src/app/admin/packers/new/NewPackerForm.tsx
  - src/app/admin/roster/page.tsx
  - src/app/admin/roster/RosterUploader.tsx
  - src/app/admin/stores/page.tsx
  - src/app/admin/stores/NewStoreForm.tsx
  - src/app/admin/stores/DeleteStoreButton.tsx
  - src/app/admin/stores/[id]/page.tsx
  - src/app/admin/stores/[id]/packers/[packerId]/page.tsx
  - src/app/admin/stores/[id]/packers/[packerId]/PackerHistory.tsx
  - src/app/manager/page.tsx
  - src/app/manager/layout.tsx
  - src/app/manager/PackerList.tsx
  - src/app/manager/[id]/page.tsx
  - src/app/manager/[id]/EditPackerForm.tsx
  - src/app/login/page.tsx
  - src/app/login/LoginForm.tsx
  - src/app/page.tsx
  - src/app/layout.tsx
  - src/components/AdminNav.tsx
  - src/components/Header.tsx
  - src/components/ui/Badge.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Input.tsx
findings:
  critical: 3
  warning: 7
  info: 3
  total: 13
status: partially_fixed
fixed_in: ae7e4f0
---

# Frontend Code Review Report

**Reviewed:** 2026-05-23
**Depth:** standard
**Files Reviewed:** 33
**Status:** partially_fixed (5 of 13 resolved: 3 fixed in ae7e4f0, 2 stale findings verified already correct)

## Summary

This review covers all frontend pages, components, and layouts for the Next.js salary info collection app. The codebase is well-structured overall: layouts enforce server-side auth, form inputs have reasonable client-side validation, React state is managed immutably, and there are no XSS vectors (no `dangerouslySetInnerHTML`, no unsanitized rendering). SQL queries use parameterized tagged templates.

However, three critical issues were found: two pages bypass authentication by calling an async auth guard without `await`, and the manager layout will crash with a runtime error if a manager account lacks a `store_id`. Additionally, all client-side forms share a systematic bug where network-level fetch failures leave the UI in a permanent loading state.

## Critical Issues

### CR-01: Export page calls `requireAdmin()` without `await` -- authentication bypass -- ALREADY FIXED

**File:** `src/app/admin/export/page.tsx:7-9`
**Note:** Code already has `await requireAdmin()`. Finding was stale.
**Issue:** `ExportPage` is a regular (non-async) function that calls `requireAdmin()` without `await`. Since `requireAdmin()` is async and uses `redirect()` internally, the redirect never actually executes -- the unresolved Promise is discarded and the page renders for any user. While the `/admin` layout also calls `requireAdmin()`, Next.js does not guarantee layout completion before page rendering in all navigation scenarios (e.g., parallel route resolution, direct deep-linking). This is a defense-in-depth failure that can expose the page to unauthenticated users.

**Fix:**
```tsx
export default async function ExportPage() {
  await requireAdmin();
  return (
    // ...
  );
}
```

### CR-02: Roster upload page calls `requireAdmin()` without `await` -- authentication bypass -- ALREADY FIXED

**File:** `src/app/admin/roster/page.tsx:8-9`
**Note:** Code already has `await requireAdmin()`. Finding was stale.
**Issue:** Identical to CR-01. `RosterUploadPage` is non-async and calls `requireAdmin()` without `await`. The auth guard is silently skipped. The `RosterUploader` client component renders without any server-side authorization check on this page.

**Fix:**
```tsx
export default async function RosterUploadPage() {
  await requireAdmin();
  return (
    // ...
  );
}
```

### CR-03: Manager layout crashes on null `store_id` via non-null assertion -- FIXED

**File:** `src/app/manager/layout.tsx:11`
**Issue:** The code uses `user.store_id!` (non-null assertion). The `requireManager()` function only checks that `role === 'manager'` -- it does not validate `store_id` is set. If a manager user exists without a `store_id` (admin creates manager before assigning a store, or store is deleted), `getStoreById(undefined)` will either throw an unhandled error or return `null`, crashing the entire `/manager` section with a server error. The same non-null assertion pattern appears in `src/app/manager/page.tsx:10,12`.

**Fix:**
```tsx
const user = await requireManager();
if (!user.store_id) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <p className="text-muted-foreground">Your account is not assigned to a store. Contact an administrator.</p>
    </div>
  );
}
const store = await getStoreById(user.store_id);
```

## Warnings

### WR-01: All client-side forms lack try/catch around `fetch` -- network errors cause permanent loading state

**Files:**
- `src/app/login/LoginForm.tsx:19-28`
- `src/app/admin/CycleControls.tsx:48-58` and `65-76`
- `src/app/admin/stores/NewStoreForm.tsx:21-36`
- `src/app/admin/stores/DeleteStoreButton.tsx:20-28`
- `src/app/admin/managers/NewManagerForm.tsx:23-38`
- `src/app/admin/packers/new/NewPackerForm.tsx:33-53`
- `src/app/manager/[id]/EditPackerForm.tsx:34-50`

**Issue:** Every client-side form calls `fetch()` without a try/catch. If `fetch` throws (network error, DNS failure, user offline), the `setBusy(false)` / `setLoading(false)` call is never reached. The submit button remains stuck in its loading state ("Signing in...", "Saving...", "Creating...", etc.) with no error message shown to the user. This is a systematic bug affecting all user-facing forms.

**Fix:** Wrap every fetch call in try/catch/finally:
```tsx
async function submit(e: React.FormEvent) {
  e.preventDefault();
  setBusy(true);
  setError(null);
  try {
    const res = await fetch(/* ... */);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Operation failed");
      return;
    }
    // success handling
  } catch {
    setError("Network error. Please check your connection and try again.");
  } finally {
    setBusy(false);
  }
}
```

### WR-02: NewManagerForm shows password in plaintext `<input type="text">` -- FIXED

**File:** `src/app/admin/managers/NewManagerForm.tsx:48`
**Issue:** The password field uses `type="text"` instead of `type="password"`. The manager's password is displayed in cleartext on the admin's screen, visible to anyone who can see the monitor. This is a credential exposure risk via shoulder surfing.

**Fix:**
```tsx
<Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="mt-1" />
```

### WR-03: `EditPackerForm` requires all three fields valid before Save is enabled

**File:** `src/app/manager/[id]/EditPackerForm.tsx:32`
**Issue:** Line 32 requires `ACCOUNT_REGEX.test(bank) && bank === bankConfirm && IFSC_REGEX.test(ifsc) && PHONE_REGEX.test(phone)` to all be true before the Save button is enabled. However, the API's `bankDetailsPartialSchema` (in `src/lib/validators.ts:34-38`) explicitly allows partial updates with optional/empty fields. A manager who has the bank account and IFSC but not the phone number cannot save their progress -- the form blocks them from saving anything until all fields are complete.

**Fix:** Allow partial saves when the API supports it. Adjust the validation to only require non-empty fields to be valid:
```tsx
const valid =
  (!bank || (ACCOUNT_REGEX.test(bank) && bank === bankConfirm)) &&
  (!ifsc || IFSC_REGEX.test(ifsc)) &&
  (!phone || PHONE_REGEX.test(phone)) &&
  (bank || ifsc || phone); // at least something to save
```

### WR-04: SQL uses PostgreSQL `::int` cast syntax -- incompatible with SQLite

**File:** `src/app/admin/page.tsx:16-17`
**Issue:** The query uses `COUNT(*)::int` and `SUM(...)::int`, which is PostgreSQL-specific cast syntax. The project is described as "Next.js + SQLite". SQLite does not support `::int` and will throw a syntax error. The same pattern appears in:
- `src/app/admin/history/page.tsx:23-28` (multiple `::int` casts)
- `src/app/admin/stores/page.tsx:19` (`COUNT(*)::int`)

If the project actually uses PostgreSQL (the tagged template `sql` import suggests `postgres` library), then this is a non-issue but the project description is misleading.

**Fix:** If SQLite: remove all `::int` casts; SQLite returns integers from aggregates natively. If PostgreSQL: disregard this finding.

### WR-05: Next.js `params` should be awaited (Next.js 15+ compatibility)

**Files:**
- `src/app/admin/history/[month]/page.tsx:20`
- `src/app/admin/stores/[id]/page.tsx:9`
- `src/app/admin/stores/[id]/packers/[packerId]/page.tsx:9-10`
- `src/app/manager/[id]/page.tsx:8`

**Issue:** In Next.js 15 (App Router), `params` is a `Promise` and must be `await`ed before accessing properties. Accessing `params.month`, `params.id` directly will throw or produce a deprecation warning. If the project runs on Next.js 13 or 14, this is currently fine but will break on the next major upgrade.

**Fix (for Next.js 15+):**
```tsx
export default async function Page({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  // ...
}
```

### WR-06: RosterUploader file input not reset on discard

**File:** `src/app/admin/roster/RosterUploader.tsx:139`
**Issue:** The "Discard" button resets React state (`preview`, `file`, `parsedRows`) but does not clear the underlying `<input type="file">` DOM element. If the user discards and then tries to re-upload the same file, the browser's `onChange` event will not fire because the `<input>` still holds the same file reference. The user would be forced to select a different file and then re-select the original.

**Fix:**
```tsx
const inputRef = useRef<HTMLInputElement>(null);
// In the input element:
<input ref={inputRef} type="file" ... />
// In the discard handler:
onClick={() => {
  setPreview(null);
  setFile(null);
  setParsedRows(null);
  if (inputRef.current) inputRef.current.value = "";
}}
```

### WR-07: `NewManagerForm` and `NewPackerForm` crash if `stores` array is empty

**Files:**
- `src/app/admin/managers/NewManagerForm.tsx:13`
- `src/app/admin/packers/new/NewPackerForm.tsx:14`

**Issue:** Both forms initialize `storeId` / `store_id` with `stores[0]?.id ?? ""`. If the `stores` array is empty, `storeId` is `""` -- an empty string. The `<select>` element renders with no `<option>` children, so the user cannot select a valid store. However, the form still submits `store_id: ""` to the API. The server would then attempt to use `""` as a store ID, which would fail a UUID validation (if enforced) or insert a bad foreign key. The form should be disabled or show a message when no stores exist.

**Fix:**
```tsx
if (stores.length === 0) {
  return <p className="text-sm text-muted-foreground">No stores exist. Create a store first.</p>;
}
```

## Info

### IN-01: Audit log page has no pagination

**File:** `src/app/admin/audit/page.tsx:31`
**Issue:** The query uses `LIMIT 200` with no pagination controls. Once the audit log exceeds 200 entries, older entries are inaccessible. The same applies to the packer history component (`PackerHistory.tsx:40` with `LIMIT 50`).

### IN-02: Bank account numbers shown unmasked in history snapshot

**File:** `src/app/admin/history/[month]/page.tsx:85`
**Issue:** The history snapshot table renders full bank account numbers, while the manager's `PackerList` component masks them (showing only last 4 digits). This inconsistency means sensitive financial data is displayed in full on one admin page but masked on another. Whether this is intentional should be confirmed.

### IN-03: `Header` sign-out does not handle fetch failure -- PARTIALLY FIXED

**File:** `src/components/Header.tsx:11-13`
**Issue:** The `signOut` function calls `fetch("/api/auth/logout")` without error handling. If the API call fails, the user is still redirected to `/login`, but the session may remain active server-side. On next visit, the user would appear still logged in. Minor issue since the session will eventually expire.

**Partial fix (ae7e4f0):** The fetch call now sends `Content-Type: application/json` header and a JSON body, which was required for the new CSRF protection. The error handling gap remains but is low-priority.

---

_Reviewed: 2026-05-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
