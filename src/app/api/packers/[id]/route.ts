import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRequireUser, apiRequireAdmin } from "@/lib/auth";
import { sql, getPackerById, getOpenCycle, deriveStatus, insertAudit } from "@/lib/db";
import { ACCOUNT_REGEX, IFSC_REGEX, PHONE_REGEX, normalizeDigits, normalizeIfsc } from "@/lib/validators";
import { requireJsonContentType } from "@/lib/csrf";

const patchSchema = z.object({
  bank_account_no: z.string().regex(ACCOUNT_REGEX, "Account number must be 9–18 digits"),
  ifsc_code: z.string().regex(IFSC_REGEX, "Invalid IFSC"),
  phone: z.string().regex(PHONE_REGEX, "Phone must be 10 digits"),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const csrfErr = requireJsonContentType(req);
  if (csrfErr) return csrfErr;

  const user = await apiRequireUser();
  const packer = await getPackerById(params.id);
  if (!packer) return NextResponse.json({ error: "Packer not found" }, { status: 404 });

  // Authorization:
  //  - admin: always allowed
  //  - manager: only own store AND only when a cycle is open
  if (user.role === "manager") {
    if (packer.store_id !== user.store_id) {
      return NextResponse.json({ error: "Not your store" }, { status: 403 });
    }
    if (!(await getOpenCycle())) {
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

  try {
    await sql.begin(async (tx) => {
      await tx`
        UPDATE packers
        SET bank_account_no = ${bank_account_no},
            ifsc_code = ${ifsc_code},
            phone = ${phone},
            bank_details_status = ${status},
            updated_at = now()
        WHERE id = ${params.id}
      `;

      for (const c of changes) {
        await tx`
          INSERT INTO audit_log (packer_id, field_changed, old_value, new_value, changed_by)
          VALUES (${params.id}, ${c.field}, ${c.old}, ${c.new}, ${user.id})
        `;
      }
    });
  } catch (e) {
    return NextResponse.json({ error: "Update failed" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await apiRequireAdmin();
  const packer = await getPackerById(params.id);
  if (!packer) return NextResponse.json({ error: "Packer not found" }, { status: 404 });

  await sql.begin(async (tx) => {
    // Delete audit log entries first (FK constraint)
    await tx`DELETE FROM audit_log WHERE packer_id = ${params.id}`;
    // Delete cycle_packers snapshots
    await tx`DELETE FROM cycle_packers WHERE packer_id = ${params.id}`;
    // Delete the packer
    await tx`DELETE FROM packers WHERE id = ${params.id}`;
  });

  await insertAudit({
    packer_id: null,
    field_changed: "packer_deleted",
    old_value: JSON.stringify({ emp_id: packer.emp_id, name: packer.name, store_id: packer.store_id }),
    new_value: null,
    changed_by: user.id,
  });

  return NextResponse.json({ ok: true });
}
