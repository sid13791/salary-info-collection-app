import { NextResponse } from "next/server";
import { apiRequireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { requireJsonContentType } from "@/lib/csrf";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  await apiRequireAdmin();
  const { id } = params;

  // Block if packers reference this store
  const [{ n: packerCount }] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM packers WHERE store_id = ${id}
  `;
  if (packerCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${packerCount} packer(s) still belong to this store. Remove them first.` },
      { status: 409 },
    );
  }

  // Block if managers are assigned to this store
  const [{ n: managerCount }] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM users WHERE store_id = ${id}
  `;
  if (managerCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${managerCount} manager(s) assigned to this store. Reassign them first.` },
      { status: 409 },
    );
  }

  // Also block if cycle_packers reference this store (historical snapshots)
  const [{ n: snapCount }] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM cycle_packers WHERE store_id = ${id}
  `;
  if (snapCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: store has historical cycle data. Contact admin to archive first.` },
      { status: 409 },
    );
  }

  const result = await sql`DELETE FROM stores WHERE id = ${id}`;
  if (result.count === 0) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
