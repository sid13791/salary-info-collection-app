import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRequireUser } from "@/lib/auth";
import { getDb, getPackerById, getOpenCycle, deriveStatus, insertAudit } from "@/lib/db";
import { ACCOUNT_REGEX, IFSC_REGEX, PHONE_REGEX, normalizeDigits, normalizeIfsc } from "@/lib/validators";

const patchSchema = z.object({
  bank_account_no: z.string().regex(ACCOUNT_REGEX, "Account number must be 9–18 digits"),
  ifsc_code: z.string().regex(IFSC_REGEX, "Invalid IFSC"),
  phone: z.string().regex(PHONE_REGEX, "Phone must be 10 digits"),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = apiRequireUser();
  const packer = getPackerById(params.id);
  if (!packer) return NextResponse.json({ error: "Packer not found" }, { status: 404 });

  // Authorization:
  //  - admin: always allowed
  //  - manager: only own store AND only when a cycle is open
  if (user.role === "manager") {
    if (packer.store_id !== user.store_id) {
      return NextResponse.json({ error: "Not your store" }, { status: 403 });
    }
    if (!getOpenCycle()) {
      return NextResponse.json({ error: "No open cycle — edits are locked" }, { status: 403 });
    }
  }

  const body = await req.json().catch(() => ({}));
  const normalized = {
    bank_account_no: typeof body.bank_account_no === "string" ? normalizeDigits(body.bank_account_no) : body.bank_account_no,
    ifsc_code: typeof body.ifsc_code === "string" ? normalizeIfsc(body.ifsc_code) : body.ifsc_code,
    phone: typeof body.phone === "string" ? normalizeDigits(body.phone) : body.phone,
  };
  const parsed = patchSchema.safeParse(normalized);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }
  const { bank_account_no, ifsc_code, phone } = parsed.data;
  const status = deriveStatus(bank_account_no, ifsc_code);

  // Compute audit deltas BEFORE writing
  const changes: Array<{ field: string; old: string | null; new: string | null }> = [];
  if ((packer.bank_account_no ?? null) !== bank_account_no) {
    changes.push({ field: "bank_account_no", old: packer.bank_account_no, new: bank_account_no });
  }
  if ((packer.ifsc_code ?? null) !== ifsc_code) {
    changes.push({ field: "ifsc_code", old: packer.ifsc_code, new: ifsc_code });
  }
  if ((packer.phone ?? null) !== phone) {
    changes.push({ field: "phone", old: packer.phone, new: phone });
  }

  const db = getDb();
  db.exec("BEGIN");
  try {
    db.prepare(`
      UPDATE packers
      SET bank_account_no = ?, ifsc_code = ?, phone = ?, bank_details_status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(bank_account_no, ifsc_code, phone, status, params.id);

    for (const c of changes) {
      insertAudit({
        packer_id: params.id,
        field_changed: c.field,
        old_value: c.old,
        new_value: c.new,
        changed_by: user.id,
      });
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
