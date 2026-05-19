import { NextResponse } from "next/server";
import { getServerSupabase, getServiceRoleSupabase } from "@/lib/supabase/server";
import { packerInputSchema, normalizeEmpId, normalizeIfsc, normalizeDigits } from "@/lib/validators";

// Admin: create packer manually
export async function POST(req: Request) {
  const supabase = getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("app_users").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const normalized = {
    ...body,
    emp_id: typeof body.emp_id === "string" ? normalizeEmpId(body.emp_id) : body.emp_id,
    ifsc_code: typeof body.ifsc_code === "string" ? normalizeIfsc(body.ifsc_code) : body.ifsc_code,
    bank_account_no: typeof body.bank_account_no === "string" ? normalizeDigits(body.bank_account_no) : body.bank_account_no,
    phone: typeof body.phone === "string" ? normalizeDigits(body.phone) : body.phone,
  };
  const parsed = packerInputSchema.safeParse(normalized);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }

  const sr = getServiceRoleSupabase();
  const { error } = await sr.from("packers").insert({
    emp_id: parsed.data.emp_id,
    name: parsed.data.name,
    store_id: parsed.data.store_id,
    is_active: true,
    bank_account_no: parsed.data.bank_account_no ?? null,
    ifsc_code: parsed.data.ifsc_code ?? null,
    phone: parsed.data.phone ?? null,
  });
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Emp ID already exists in this store" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
