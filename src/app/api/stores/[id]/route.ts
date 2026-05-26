import { NextResponse } from "next/server";
import { apiRequireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { requireJsonContentType } from "@/lib/csrf";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  const csrfErr = requireJsonContentType(req);
  if (csrfErr) return csrfErr;

  const user = await apiRequireAdmin();
  const { id } = params;

  // Verify store exists and capture name for audit
  const rows = await sql<{ name: string }[]>`
    SELECT name FROM stores WHERE id = ${id}
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }
  const storeName = rows[0].name;

  // Count deps before deleting (for audit trail)
  const [counts] = await sql<{ packers: number; managers: number }[]>`
    SELECT
      (SELECT count(*)::int FROM packers WHERE store_id = ${id}) AS packers,
      (SELECT count(*)::int FROM users WHERE store_id = ${id})   AS managers
  `;

  // Cascade delete in FK-safe order within a single transaction
  await sql.begin(async (tx) => {
    // Clear audit_log rows referencing packers in this store (packer_id FK)
    await tx`DELETE FROM audit_log WHERE packer_id IN (SELECT id FROM packers WHERE store_id = ${id})`;
    // Clear audit_log rows authored by managers of this store (changed_by FK)
    await tx`DELETE FROM audit_log WHERE changed_by IN (SELECT id FROM users WHERE store_id = ${id})`;
    // Delete cycle snapshots by packer membership (safer than by store_id)
    await tx`DELETE FROM cycle_packers WHERE packer_id IN (SELECT id FROM packers WHERE store_id = ${id})`;
    await tx`DELETE FROM packers WHERE store_id = ${id}`;
    await tx`DELETE FROM users WHERE store_id = ${id}`;
    await tx`DELETE FROM stores WHERE id = ${id}`;

    // Record deletion inside the transaction for atomicity
    await tx`
      INSERT INTO audit_log (packer_id, field_changed, old_value, new_value, changed_by)
      VALUES (
        NULL,
        ${"store_deleted"},
        ${JSON.stringify({ name: storeName, packers: counts.packers, managers: counts.managers })},
        NULL,
        ${user.id}
      )
    `;
  });

  return NextResponse.json({ ok: true });
}
