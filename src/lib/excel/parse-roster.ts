import * as XLSX from "xlsx";
import type { UploadedRow } from "../roster-diff";

export interface ParseResult {
  rows: UploadedRow[];
  errors: string[];
}

const REQUIRED_HEADERS = ["emp_id", "name", "store_code"] as const;

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
      emp_id: String(map.emp_id ?? "").trim(),
      name: String(map.name ?? "").trim(),
      store_code: String(map.store_code ?? "").trim(),
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
    ["emp_id", "name", "store_code"],
    ["PKR001", "Ramesh Kumar", "NCR01"],
    ["PKR002", "Sunita Sharma", "NCR01"],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Roster");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
