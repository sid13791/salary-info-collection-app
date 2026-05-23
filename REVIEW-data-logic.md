---
reviewed: 2026-05-23T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/lib/validators.ts
  - src/lib/validators.test.ts
  - src/lib/roster-diff.ts
  - src/lib/roster-diff.test.ts
  - src/lib/excel/generate-export.ts
  - src/lib/excel/parse-roster.ts
  - src/lib/cn.ts
  - scripts/init-db.mjs
  - scripts/create-admin.mjs
findings:
  critical: 3
  warning: 6
  info: 3
  total: 12
status: partially_fixed
fixed_in: see individual findings
---

# Code Review Report: Data Handling, Business Logic, and Utilities

**Reviewed:** 2026-05-23
**Depth:** standard
**Files Reviewed:** 9
**Status:** partially_fixed (4 of 12 fixed, 8 open)

## Summary

Review covered data validation (validators.ts), roster diff logic (roster-diff.ts), Excel parsing/generation (parse-roster.ts, generate-export.ts), and database setup scripts (init-db.mjs, create-admin.mjs). Three critical issues were found: a duplicate-row logic bug that silently triggers false deactivations, a partial-schema validation gap that allows inconsistent bank data to reach the database and crash, and a weak password hashing cost parameter. Six warnings address missing normalization in schemas, unbounded upload size, fragile header matching, unsanitized Excel sheet names, a type mismatch between DB and TypeScript, and a dead-code export. The core roster-diff logic is well-structured and its test suite is solid, but the duplicate-handling bug is severe enough to cause real data loss in production.

## Critical Issues

### CR-01: Duplicate rows in upload cause false deactivation of existing packers -- ALREADY FIXED

**File:** `src/lib/roster-diff.ts:74-119,144-152`
**Note:** Code already keeps first occurrence and rejects subsequent duplicates (lines 101-109). Finding was stale.
**Issue:** When the upload contains duplicate `(emp_id, store_code)` pairs, ALL occurrences are pushed into `invalidRows` (lines 112-118). None survive into `seenInUpload`. This means if an admin accidentally pastes the same employee twice, the employee is treated as absent from the upload entirely.

Concrete scenario: existing active packer PKR001 in store NCR01. Admin uploads a roster that contains PKR001/NCR01 on two rows (common copy-paste error). Both rows are marked invalid via the `dupesInUpload` set. `seenInUpload` never receives the key `PKR001::NCR01`. The deactivation loop (line 144-152) sees PKR001/NCR01 is not in `seenInUpload` and pushes PKR001 into `deactivated`. If the admin commits this diff without carefully inspecting every row, an active employee gets deactivated because of a formatting error in the upload.

This is a data integrity bug that can cause real harm -- a deactivated packer may not receive their salary payout.

**Fix:** Keep the first occurrence and only flag subsequent duplicates as invalid:
```typescript
// Replace the dupesInUpload pre-scan (lines 74-82) with inline tracking:
const seenKeys = new Set<string>();

for (const row of normalized) {
  // ... validation checks ...
  
  const key = `${row.emp_id}::${row.store_code}`;
  if (seenKeys.has(key)) {
    result.invalidRows.push({
      row: upRow, rowIndex: row.rowIndex,
      reason: `Duplicate emp_id "${row.emp_id}" in same store (keeping first occurrence)`,
    });
    continue;
  }
  seenKeys.add(key);
  seenInUpload.add(key);  // ensure deactivation logic sees this key
  
  // ... rest of matching logic
}
```

### CR-02: bankDetailsPartialSchema allows empty strings that will crash at the DB layer -- FIXED (removed dead code)

**File:** `src/lib/validators.ts:34-38`
**Issue:** The `.optional().or(z.literal(""))` pattern means empty strings pass Zod validation. However, the PostgreSQL schema has CHECK constraints: `CHECK (bank_account_no IS NULL OR bank_account_no ~ '^[0-9]{9,18}$')`. An empty string is not NULL and does not match the regex, so the INSERT/UPDATE will throw a Postgres constraint violation error. This surfaces as an unhandled 400 with a raw DB error message (compounding CR-03 from the prior REVIEW.md) rather than a clean validation error.

Additionally, the schema allows submitting `bank_account_no` without `ifsc_code` or vice versa. An account number without an IFSC is not usable for bank transfers, creating a state where `bank_details_status` may be marked `provided` even though the data is incomplete and unusable.

Note: `bankDetailsPartialSchema` currently has zero imports (dead code), but the pattern it establishes -- and the `bankDetailsSchema` which IS used -- both lack cross-field validation.

**Fix:** Transform empty strings to `undefined` and add cross-field refinement:
```typescript
export const bankDetailsPartialSchema = z.object({
  bank_account_no: z.string().regex(ACCOUNT_REGEX).optional()
    .or(z.literal("")).transform(v => v || undefined),
  ifsc_code: z.string().regex(IFSC_REGEX).optional()
    .or(z.literal("")).transform(v => v || undefined),
  phone: z.string().regex(PHONE_REGEX).optional()
    .or(z.literal("")).transform(v => v || undefined),
}).refine(
  (d) => (!!d.bank_account_no) === (!!d.ifsc_code),
  { message: "bank_account_no and ifsc_code must both be provided or both be empty" }
);
```

### CR-03: scrypt cost parameter N=16384 is below OWASP minimum for admin passwords -- FIXED

**File:** `scripts/create-admin.mjs:31`, `src/lib/password.ts`
**Issue:** `scryptSync(pw, salt, 64, { N: 16384 })` uses `N=2^14`. OWASP's 2023 guidance recommends a minimum of `N=32768` (2^15) with `r=8, p=1` for scrypt. This script creates admin accounts -- the highest-privilege users in the system. The `r` and `p` parameters are not specified, relying on Node.js defaults (which are acceptable), but the low `N` value reduces brute-force resistance for the most sensitive credentials in the application.

**Fix:**
```javascript
const hash = scryptSync(pw, salt, 64, { N: 32768, r: 8, p: 1 });
```

## Warnings

### WR-01: Zod schemas validate patterns but normalization is applied externally and inconsistently

**File:** `src/lib/validators.ts:27-47`
**Issue:** `bankDetailsSchema` and `packerInputSchema` validate regex patterns but expect the caller to normalize first. The PATCH route at `src/app/api/packers/[id]/route.ts:30-35` normalizes before validating (correct), but there is no guarantee every future caller will do the same. If lowercase IFSC or phone numbers with dashes reach these schemas directly, validation fails with a confusing error message even though the input is semantically valid.

`normalizeDigits` strips ALL non-digit characters. This means `"12-34-56-78-90"` becomes `"1234567890"` -- a valid phone number. But `"abc"` becomes `""` which then fails the regex. The normalization-before-validation pattern works but is fragile because it is not co-located with the validation.

**Fix:** Embed normalization into Zod schemas using `.transform()` + `.pipe()`:
```typescript
export const bankDetailsSchema = z.object({
  bank_account_no: z.string().transform(normalizeDigits)
    .pipe(z.string().regex(ACCOUNT_REGEX, "Account number must be 9-18 digits")),
  ifsc_code: z.string().transform(normalizeIfsc)
    .pipe(z.string().regex(IFSC_REGEX, "IFSC must be 4 letters + 0 + 6 alphanumeric")),
  phone: z.string().transform(normalizeDigits)
    .pipe(z.string().regex(PHONE_REGEX, "Phone must be exactly 10 digits")),
});
```

### WR-02: parseRosterBuffer accepts unbounded row count -- no upload size cap

**File:** `src/lib/excel/parse-roster.ts:21`
**Issue:** `XLSX.utils.sheet_to_json(sheet, { defval: "" })` will parse every row in the sheet with no limit. A malicious or accidental upload with hundreds of thousands of rows will cause memory exhaustion on the server. The downstream `diffRoster` function also builds multiple `Map` and `Set` structures from the full row set, amplifying memory usage.

**Fix:** Add a row count cap after parsing:
```typescript
const MAX_ROSTER_ROWS = 10_000;
if (raw.length > MAX_ROSTER_ROWS) {
  return { rows: [], errors: [`Too many rows (${raw.length}). Maximum is ${MAX_ROSTER_ROWS}.`] };
}
```

### WR-03: Excel header matching breaks on common formatting variations

**File:** `src/lib/excel/parse-roster.ts:27-28`
**Issue:** Headers are trimmed and lowercased, which handles `" Emp_ID "`. But common Excel variations like `"Emp ID"` (space instead of underscore), `"Employee ID"`, or `"EMP  ID"` (double space) will not match `"emp_id"`. The error message says "Missing required column(s): emp_id" but the user sees "Emp ID" in their spreadsheet and is confused. This is a usability problem that will generate support requests.

**Fix:** Normalize whitespace and common separators to underscores:
```typescript
const headers = Object.keys(raw[0]).map((h) =>
  h.trim().toLowerCase().replace(/[\s-]+/g, '_')
);
```

### WR-04: generateBackupExport does not sanitize sheet names for Excel restrictions

**File:** `src/lib/excel/generate-export.ts:53`
**Issue:** `name.slice(0, 31)` handles the 31-character limit, but Excel sheet names cannot contain `\ / * ? [ ] :`. If a key in `payload` contained any of these characters (unlikely with the current hardcoded keys but possible if the function is reused), `book_append_sheet` would throw an unhandled error. The function's parameter type (`Record<string, unknown>` values) already suggests it's designed for generic use.

**Fix:**
```typescript
const safeName = name.replace(/[\\/*?\[\]:]/g, '_').slice(0, 31);
XLSX.utils.book_append_sheet(wb, ws, safeName);
```

### WR-05: ExistingPacker.is_active is typed as boolean but DB stores SMALLINT 0/1

**File:** `src/lib/roster-diff.ts:8` cross-referenced with `db/schema.postgres.sql:31`
**Issue:** The `ExistingPacker` interface declares `is_active: boolean`, but the database column is `SMALLINT NOT NULL DEFAULT 1 CHECK (is_active IN (0,1))`. The postgres.js driver returns `SMALLINT` values as JavaScript numbers (`0` or `1`), not booleans. The code at `roster-diff.ts:124` uses `if (matchExact.is_active)` which works via JavaScript truthiness (`1` is truthy, `0` is falsy), so the logic happens to be correct. However, strict equality checks like `if (is_active === true)` would silently fail. The type declaration is misleading and any future code relying on the `boolean` type will introduce bugs.

**Fix:** Either change the TypeScript interface to `is_active: number` (matching reality) and document the 0/1 convention, or add a mapping layer that converts SMALLINT to boolean when reading from the database.

### WR-06: Test uses non-deterministic random IDs that could theoretically collide

**File:** `src/lib/roster-diff.test.ts:8`
**Issue:** `Math.random().toString(36).slice(2, 8)` generates a 6-character random string for test fixture IDs. While collision probability is low in a single test run, this introduces non-determinism. The complex scenario test (line 97-117) uses explicit IDs `"1"`, `"2"`, `"3"` -- which is the correct pattern. The `existing()` helper should use a deterministic counter instead.

**Fix:**
```typescript
let idCounter = 0;
function existing(overrides: Partial<ExistingPacker> = {}): ExistingPacker {
  return {
    id: overrides.id ?? `id-${++idCounter}`,
    // ...
  };
}
```

## Info

### IN-01: bankDetailsPartialSchema is exported but never imported anywhere -- FIXED (removed)

**File:** `src/lib/validators.ts:34`
**Issue:** Grep across the entire `src/` directory shows zero imports of `bankDetailsPartialSchema`. This is dead code. If it was intended for partial updates, the PATCH route at `src/app/api/packers/[id]/route.ts` defines its own inline `patchSchema` instead.

**Fix:** Remove the dead export, or refactor the PATCH route to use it (after fixing CR-02).

### IN-02: Test for duplicates uses weak assertion that masks actual behavior

**File:** `src/lib/roster-diff.test.ts:93-94`
**Issue:** `expect(d.invalidRows.length).toBeGreaterThanOrEqual(1)` does not assert the exact count. With 2 duplicate rows, the current code marks BOTH as invalid (count = 2). Using `>= 1` hides whether the implementation keeps one or rejects all. Given CR-01, this test should be updated to assert the intended behavior precisely once the deduplication strategy is decided.

**Fix:** After fixing CR-01, update to `expect(d.invalidRows).toHaveLength(1)` (if keeping first) and verify the surviving row is in the correct category.

### IN-03: EMP_ID_REGEX allows dots and hyphens but normalizeEmpId does not normalize them

**File:** `src/lib/validators.ts:6,10-11`
**Issue:** `EMP_ID_REGEX = /^[A-Z0-9._-]{1,32}$/` allows `.`, `_`, `-` in employee IDs. `normalizeEmpId` only trims and uppercases. If the same employee is entered as `PKR.001` in one system and `PKR001` in another, they will not match during roster diff, leading to a phantom "new packer" and a deactivation of the dotted variant. Whether dots/hyphens are valid in employee IDs should be documented.

**Fix:** Either strip `.`, `_`, `-` in `normalizeEmpId` if they are never meaningful, or document that these characters are significant and must be entered consistently.

---

_Reviewed: 2026-05-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
