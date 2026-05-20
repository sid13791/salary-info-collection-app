import { NextResponse } from "next/server";
import { apiRequireAdmin } from "@/lib/auth";
import { getDb, deriveStatus, insertAudit, newId } from "@/lib/db";
import { packerInputSchema, normalizeEmpId, normalizeIfsc, normalizeDigits } from "@/lib/validators";

// Admin: create packer manually
export async function POST(req: Request) {
  const user = apiRequireAdmin();
  const body = await req.json().catch(() => ({}));

  const normalized = {
    ...body,
    emp_id: typeof body.emp_id === "string" ? normalizeEmpId(body.emp_id) : body.emp_id,
    ifsc_code: typeof body.ifsc_code === "string" && body.ifsc_code ? normalizeIfsc(body.ifsc_code) : body.ifsc_code,
    bank_account_no: typeof body.bank_account_no === "string" && body.bank_account_no ? normalizeDigits(body.bank_account_no) : body.bank_account_no,
    phone: typeof body.phone === "string" && body.phone ? normalizeDigits(body.phone) : body.phone,
  };
  const parsed = packerInputSchema.safeParse(normalized);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }
  const p = parsed.data;
  const status = deriveStatus(p.bank_account_no ?? null, p.ifsc_code ?? null);
  const id = newId();

  try {
    getDb()
      .prepare(`
        INSERT INTO packers (id, emp_id, name, store_id, is_active, bank_account_no, ifsc_code, phone, bank_details_status)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
      `)
      .run(
        id,
        p.emp_id,
        p.name,
        p.store_id,
        p.bank_account_no ?? null,
        p.ifsc_code ?? null,
        p.phone ?? null,
        status,
      );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("UNIQUE") || msg.includes("unique")) {
      return NextResponse.json({ error: "Emp ID already exists in this store" }, { status: 409 });
    }
    return NextResponse.json({ error: msg || "Insert failed" }, { status: 400 });
  }

  insertAudit({
    packer_id: id,
    field_changed: "packer_created",
    old_value: null,
    new_value: `emp_id=${p.emp_id} store_id=${p.store_id}`,
    changed_by: user.id,
  });
  return NextResponse.json({ ok: true, id });
}
