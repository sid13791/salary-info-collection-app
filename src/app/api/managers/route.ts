import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRequireAdmin } from "@/lib/auth";
import { sql, getStoreById, newId } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { requireJsonContentType } from "@/lib/csrf";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  store_id: z.string().uuid(),
});

export async function POST(req: Request) {
  const csrfErr = requireJsonContentType(req);
  if (csrfErr) return csrfErr;

  await apiRequireAdmin();
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  if (!(await getStoreById(parsed.data.store_id))) {
    return NextResponse.json({ error: "Store not found" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();

  try {
    await sql`
      INSERT INTO users (id, email, password_hash, role, store_id, is_active, must_change_password)
      VALUES (${newId()}, ${email}, ${hashPassword(parsed.data.password)}, 'manager', ${parsed.data.store_id}, 1, 1)
    `;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("UNIQUE") || msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Create failed" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
