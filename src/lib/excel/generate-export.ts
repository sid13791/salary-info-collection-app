import * as XLSX from "xlsx";

export interface ExportRow {
  emp_id: string;
  name: string;
  store_name: string;
  bank_account_no: string | null;
  ifsc_code: string | null;
  phone: string | null;
}

/** Bank-export Excel — stable column order. Admin adds an Amount column post-download. */
export function generateBankExport(rows: ExportRow[], month: string): Buffer {
  const data = [
    [
      "emp_id",
      "name",
      "store_name",
      "bank_account_no",
      "ifsc_code",
      "phone",
      "amount", // intentionally empty — filled by admin before ICICI upload
    ],
    ...rows.map((r) => [
      r.emp_id,
      r.name,
      r.store_name,
      r.bank_account_no ?? "",
      r.ifsc_code ?? "",
      r.phone ?? "",
      "",
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Payout ${month}`);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

/** Full-database backup export. Multi-sheet. */
export function generateBackupExport(payload: {
  stores: Array<Record<string, unknown>>;
  packers: Array<Record<string, unknown>>;
  cycles: Array<Record<string, unknown>>;
  audit_log: Array<Record<string, unknown>>;
}): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(payload)) {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
