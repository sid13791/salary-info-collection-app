import { NextResponse } from "next/server";
import { apiRequireAdmin } from "@/lib/auth";
import { sql, getStores, getLatestClosedCycle, type Cycle } from "@/lib/db";
import { generateBankExport, type ExportRow } from "@/lib/excel/generate-export";
import { MONTH_REGEX } from "@/lib/validators";

export async function GET(req: Request) {
  await apiRequireAdmin();
  const stores = await getStores();
  const storeById = new Map(stores.map((s) => [s.id, s]));

  const url = new URL(req.url);
  const monthParam = url.searchParams.get("month");
  if (monthParam !== null && !MONTH_REGEX.test(monthParam)) {
    return NextResponse.json({ error: "Invalid month (expected YYYY-MM)" }, { status: 400 });
  }

  type Source = {
    emp_id: string; name: string; store_id: string;
    user_status: string; role_name: string | null;
    bank_account_no: string | null; ifsc_code: string | null; phone: string | null;
  };

  let exportRows: ExportRow[];
  let month: string;

  // Historical export — re-render frozen snapshot for the requested month
  if (monthParam) {
    const cycleRows = await sql<Cycle[]>`
      SELECT * FROM cycles WHERE month = ${monthParam} AND status = 'closed'
    `;
    const cycle = cycleRows[0] ?? null;
    if (!cycle) {
      return NextResponse.json({ error: "No closed cycle found for that month" }, { status: 404 });
    }
    const snap = [...await sql<Source[]>`
      SELECT * FROM cycle_packers WHERE cycle_id = ${cycle.id} AND is_active = 1
    `];
    exportRows = snap.map((p) => toExportRow(p, storeById));
    month = cycle.month;
    const buf = generateBankExport(exportRows, month);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="bank_export_${month}.xlsx"`,
      },
    });
  }

  const lastClosed = await getLatestClosedCycle();

  if (lastClosed) {
    const snap = [...await sql<Source[]>`
      SELECT * FROM cycle_packers WHERE cycle_id = ${lastClosed.id} AND is_active = 1
    `];
    exportRows = snap.map((p) => toExportRow(p, storeById));
    month = lastClosed.month;
  } else {
    const packers = [...await sql<Source[]>`
      SELECT * FROM packers WHERE is_active = 1 ORDER BY emp_id
    `];
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
  p: { emp_id: string; name: string; store_id: string; user_status?: string; role_name?: string | null; bank_account_no: string | null; ifsc_code: string | null; phone: string | null },
  storeById: Map<string, { name: string }>,
): ExportRow {
  return {
    emp_id: p.emp_id,
    name: p.name,
    store_name: storeById.get(p.store_id)?.name ?? "",
    current_role_name: p.role_name ?? "",
    user_status: p.user_status ?? "ACTIVE",
    bank_account_no: p.bank_account_no,
    ifsc_code: p.ifsc_code,
    phone: p.phone,
  };
}
