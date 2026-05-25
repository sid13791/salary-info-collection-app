import { NextResponse } from "next/server";
import { apiRequireAdmin } from "@/lib/auth";
import { sql, insertAudit } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
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

  // Cascade delete in FK-safe order
  await sql.begin(async (tx) => {
    await tx`DELETE FROM audit_log WHERE packer_id IN (SELECT id FROM packers WHERE store_id = ${id})`;
    await tx`DELETE FROM cycle_packers WHERE store_id = ${id}`;
    await tx`DELETE FROM packers WHERE store_id = ${id}`;
    await tx`DELETE FROM users WHERE store_id = ${id}`;
    await tx`DELETE FROM stores WHERE id = ${id}`;
  });

  // Record deletion after transaction (audit_log entries for this store were cleared above)
  await insertAudit({
    packer_id: null,
    field_changed: "store_deleted",
    old_value: JSON.stringify({ name: storeName, packers: counts.packers, managers: counts.managers }),
    new_value: null,
    changed_by: user.id,
  });

  return NextResponse.json({ ok: true });
}
