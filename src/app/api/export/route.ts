import { NextResponse } from "next/server";
import { getServerSupabase, getServiceRoleSupabase } from "@/lib/supabase/server";
import { generateBankExport, type ExportRow } from "@/lib/excel/generate-export";

export async function GET() {
  const supabase = getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("app_users").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sr = getServiceRoleSupabase();

  // Prefer the latest CLOSED cycle's snapshot if available; otherwise live data.
  const { data: lastClosed } = await sr
    .from("cycles").select("id, month")
    .eq("status", "closed")
    .order("closed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: stores } = await sr.from("stores").select("id, code, name");
  const storeById = new Map((stores ?? []).map((s) => [s.id, s]));

  let rows: ExportRow[];
  let month: string;

  if (lastClosed) {
    const { data: snap } = await sr.from("cycle_packers").select("*").eq("cycle_id", lastClosed.id).eq("is_active", true);
    rows = (snap ?? []).map((p) => ({
      emp_id: p.emp_id,
      name: p.name,
      store_code: storeById.get(p.store_id)?.code ?? "",
      store_name: storeById.get(p.store_id)?.name ?? "",
      bank_account_no: p.bank_account_no,
      ifsc_code: p.ifsc_code,
      phone: p.phone,
    }));
    month = lastClosed.month;
  } else {
    const { data: packers } = await sr.from("packers").select("*").eq("is_active", true);
    rows = (packers ?? []).map((p) => ({
      emp_id: p.emp_id,
      name: p.name,
      store_code: storeById.get(p.store_id)?.code ?? "",
      store_name: storeById.get(p.store_id)?.name ?? "",
      bank_account_no: p.bank_account_no,
      ifsc_code: p.ifsc_code,
      phone: p.phone,
    }));
    const now = new Date();
    month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  const buf = generateBankExport(rows, month);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="bank_export_${month}.xlsx"`,
    },
  });
}
