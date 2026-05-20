import { NextResponse } from "next/server";
import { apiRequireAdmin } from "@/lib/auth";
import { getDb, getStores, getLatestClosedCycle, rows as toRows } from "@/lib/db";
import { generateBankExport, type ExportRow } from "@/lib/excel/generate-export";

export async function GET() {
  apiRequireAdmin();
  const db = getDb();
  const stores = getStores();
  const storeById = new Map(stores.map((s) => [s.id, s]));

  const lastClosed = getLatestClosedCycle();
  let exportRows: ExportRow[];
  let month: string;

  type Source = {
    emp_id: string; name: string; store_id: string;
    bank_account_no: string | null; ifsc_code: string | null; phone: string | null;
  };

  if (lastClosed) {
    const snap = toRows<Source>(
      db.prepare("SELECT * FROM cycle_packers WHERE cycle_id = ? AND is_active = 1").all(lastClosed.id),
    );
    exportRows = snap.map((p) => toExportRow(p, storeById));
    month = lastClosed.month;
  } else {
    const packers = toRows<Source>(
      db.prepare("SELECT * FROM packers WHERE is_active = 1 ORDER BY emp_id").all(),
    );
    exportRows = packers.map((p) => toExportRow(p, storeById));
    const now = new Date();
    month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  const buf = generateBankExport(exportRows, month);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="bank_export_${month}.xlsx"`,
    },
  });
}

function toExportRow(
  p: { emp_id: string; name: string; store_id: string; bank_account_no: string | null; ifsc_code: string | null; phone: string | null },
  storeById: Map<string, { code: string; name: string }>,
): ExportRow {
  return {
    emp_id: p.emp_id,
    name: p.name,
    store_code: storeById.get(p.store_id)?.code ?? "",
    store_name: storeById.get(p.store_id)?.name ?? "",
    bank_account_no: p.bank_account_no,
    ifsc_code: p.ifsc_code,
    phone: p.phone,
  };
}
