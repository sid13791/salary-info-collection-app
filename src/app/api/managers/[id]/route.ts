import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRequireAdmin } from "@/lib/auth";
import { sql, getStoreById } from "@/lib/db";
import { requireJsonContentType } from "@/lib/csrf";

const bodySchema = z.object({
  store_id: z.string().uuid(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const csrfErr = requireJsonContentType(req);
  if (csrfErr) return csrfErr;

  await apiRequireAdmin();
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  if (!(await getStoreById(parsed.data.store_id))) {
    return NextResponse.json({ error: "Store not found" }, { status: 400 });
  }

  const result = await sql`
    UPDATE users SET store_id = ${parsed.data.store_id}
    WHERE id = ${params.id} AND role = 'manager'
  `;
  if (result.count === 0) {
    return NextResponse.json({ error: "Manager not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
