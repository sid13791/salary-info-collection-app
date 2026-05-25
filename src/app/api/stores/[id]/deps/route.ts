import { NextResponse } from "next/server";
import { apiRequireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  await apiRequireAdmin();
  const { id } = params;

  const [row] = await sql<{ packerCount: number; managerCount: number }[]>`
    SELECT
      (SELECT count(*)::int FROM packers WHERE store_id = ${id}) AS "packerCount",
      (SELECT count(*)::int FROM users WHERE store_id = ${id})   AS "managerCount"
  `;

  return NextResponse.json(row);
}
