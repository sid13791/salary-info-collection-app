import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRequireAdmin } from "@/lib/auth";
import { sql, newId } from "@/lib/db";
import { requireJsonContentType } from "@/lib/csrf";

const bodySchema = z.object({
  name: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const csrfErr = requireJsonContentType(req);
  if (csrfErr) return csrfErr;

  await apiRequireAdmin();
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const name = parsed.data.name.trim();

  try {
    await sql`INSERT INTO stores (id, name) VALUES (${newId()}, ${name})`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("UNIQUE") || msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ error: `Store "${name}" already exists` }, { status: 409 });
    }
    return NextResponse.json({ error: "Create failed" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, name });
}
