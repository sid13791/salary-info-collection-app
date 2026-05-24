import * as XLSX from "xlsx";
import type { UploadedRow } from "../roster-diff";

export interface ParseResult {
  rows: UploadedRow[];
  errors: string[];
}

const REQUIRED_HEADERS = ["employee_code", "full_name", "store_name", "current_role_name", "packman_status"] as const;

/**
 * Parse an .xlsx buffer into UploadedRow[]. Performs only structural validation
 * (column presence). Row-level validation happens in roster-diff.
 */
export function parseRosterBuffer(buf: ArrayBuffer | Buffer): ParseResult {
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], errors: ["Workbook has no sheets"] };

  const sheet = wb.Sheets[sheetName];
  const raw: Array<Record<string, unknown>> = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (raw.length === 0) {
    return { rows: [], errors: ["Sheet is empty"] };
  }

  const headers = Object.keys(raw[0]).map((h) => h.trim().toLowerCase());
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length) {
    return {
      rows: [],
      errors: [`Missing required column(s): ${missing.join(", ")}. Expected: ${REQUIRED_HEADERS.join(", ")}.`],
    };
  }

  const rows: UploadedRow[] = raw.map((r) => {
    const map = lowerKeyMap(r);
    return {
      emp_id: String(map.employee_code ?? "").trim(),
      name: String(map.full_name ?? "").trim(),
      store_name: String(map.store_name ?? "").trim(),
      packman_status: String(map.packman_status ?? map.user_status ?? "ACTIVE").trim(),
    };
  });

  return { rows, errors: [] };
}

function lowerKeyMap(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[k.trim().toLowerCase()] = v;
  return out;
}

/** Generates a downloadable .xlsx template for admins. */
export function generateRosterTemplate(): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([
    ["store_name", "full_name", "employee_code", "current_role_name", "packman_status"],
    ["NOD-Sector-10 New", "Ramesh Kumar", "EMP0001001", "FR_Associate", "ACTIVE"],
    ["NOD-Sector-10 New", "Sunita Sharma", "EMP0001002", "FR_IB Associate", "ACTIVE"],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Roster");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
