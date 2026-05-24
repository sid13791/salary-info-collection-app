import { normalizeEmpId, normalizeStoreName } from "./validators";

export interface ExistingPacker {
  id: string;
  emp_id: string;
  store_name: string;
  store_id: string;
  is_active: boolean;
  name: string;
}

export interface UploadedRow {
  emp_id: string;
  name: string;
  store_name: string;
  packman_status: string;
  current_role_name: string;
}

export interface RosterDiff {
  matched: Array<{ existing: ExistingPacker; uploaded: UploadedRow }>;
  newPackers: UploadedRow[];
  reactivated: Array<{ existing: ExistingPacker; uploaded: UploadedRow }>;
  deactivated: ExistingPacker[];
  storeMigrations: Array<{ existing: ExistingPacker; uploaded: UploadedRow }>;
  invalidRows: Array<{ row: UploadedRow; reason: string; rowIndex: number }>;
}

/**
 * Pure function — given the current DB roster and an uploaded roster,
 * compute what should happen on commit.
 *
 *  - matched         existing active packers, store unchanged → carry forward as-is
 *  - newPackers      emp_ids never seen in this store before
 *  - reactivated     existing but currently inactive packers, returning
 *  - deactivated     in DB and active, not in upload → mark inactive
 *  - storeMigrations same emp_id appears in a DIFFERENT store than DB → warn admin
 *  - invalidRows     malformed input
 */
export function diffRoster(
  existing: ExistingPacker[],
  uploaded: UploadedRow[],
  knownStoreNames: Set<string>,
): RosterDiff {
  const result: RosterDiff = {
    matched: [],
    newPackers: [],
    reactivated: [],
    deactivated: [],
    storeMigrations: [],
    invalidRows: [],
  };

  // Index existing by (emp_id, store_name) and by emp_id alone for migration detection
  const byKey = new Map<string, ExistingPacker>();
  const byEmpId = new Map<string, ExistingPacker[]>();
  for (const p of existing) {
    const key = `${p.emp_id}::${p.store_name}`;
    byKey.set(key, p);
    const list = byEmpId.get(p.emp_id) ?? [];
    list.push(p);
    byEmpId.set(p.emp_id, list);
  }

  const seenInUpload = new Set<string>();

  // Normalize first
  const normalized = uploaded.map((r, i) => ({
    rowIndex: i,
    emp_id: normalizeEmpId(r.emp_id ?? ""),
    name: (r.name ?? "").trim(),
    store_name: normalizeStoreName(r.store_name ?? ""),
    packman_status: (r.packman_status ?? "").trim().toUpperCase(),
    current_role_name: (r.current_role_name ?? "").trim(),
  }));

  for (const row of normalized) {
    const upRow: UploadedRow = {
      emp_id: row.emp_id,
      name: row.name,
      store_name: row.store_name,
      packman_status: row.packman_status,
      current_role_name: row.current_role_name,
    };

    if (!row.emp_id) {
      result.invalidRows.push({ row: upRow, rowIndex: row.rowIndex, reason: "Missing emp_id" });
      continue;
    }
    if (!row.name) {
      result.invalidRows.push({ row: upRow, rowIndex: row.rowIndex, reason: "Missing name" });
      continue;
    }
    if (!row.store_name) {
      result.invalidRows.push({ row: upRow, rowIndex: row.rowIndex, reason: "Missing store_name" });
      continue;
    }
    if (!knownStoreNames.has(row.store_name)) {
      result.invalidRows.push({
        row: upRow,
        rowIndex: row.rowIndex,
        reason: `Unknown store_name "${row.store_name}"`,
      });
      continue;
    }
    const key = `${row.emp_id}::${row.store_name}`;
    if (seenInUpload.has(key)) {
      result.invalidRows.push({
        row: upRow,
        rowIndex: row.rowIndex,
        reason: `Duplicate emp_id "${row.emp_id}" in same store within upload`,
      });
      continue;
    }
    seenInUpload.add(key);

    const matchExact = byKey.get(key);
    if (matchExact) {
      // Presence in upload means the packer stays — user_status is just a label.
      if (matchExact.is_active) {
        result.matched.push({ existing: matchExact, uploaded: upRow });
      } else {
        result.reactivated.push({ existing: matchExact, uploaded: upRow });
      }
      continue;
    }

    // Same emp_id exists but in a different store — flag as potential migration
    const otherStoreMatches = byEmpId.get(row.emp_id) ?? [];
    const inOtherStore = otherStoreMatches.find((p) => p.store_name !== row.store_name);
    if (inOtherStore) {
      result.storeMigrations.push({ existing: inOtherStore, uploaded: upRow });
      continue;
    }

    result.newPackers.push(upRow);
  }

  // Deactivate: active DB packers not seen in this upload at all
  for (const p of existing) {
    if (!p.is_active) continue;
    const key = `${p.emp_id}::${p.store_name}`;
    if (seenInUpload.has(key)) continue;
    // Skip if already flagged as a store migration
    const inMigrations = result.storeMigrations.some((m) => m.existing.id === p.id);
    if (inMigrations) continue;
    result.deactivated.push(p);
  }

  return result;
}
