import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRequireAdmin } from "@/lib/auth";
import { getDb, getStoreById, newId } from "@/lib/db";
import { hashPassword } from "@/lib/password";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  store_id: z.string().min(1),
});

export async function POST(req: Request) {
  apiRequireAdmin();
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  if (!getStoreById(parsed.data.store_id)) {
    return NextResponse.json({ error: "Store not found" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();

  try {
    getDb()
      .prepare(`
        INSERT INTO users (id, email, password_hash, role, store_id, is_active, must_change_password)
        VALUES (?, ?, ?, 'manager', ?, 1, 1)
      `)
      .run(newId(), email, hashPassword(parsed.data.password), parsed.data.store_id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("UNIQUE") || msg.includes("unique")) {
      return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: msg || "Create failed" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
