import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRequireAdmin } from "@/lib/auth";
import { sql, newId } from "@/lib/db";
import { normalizeStoreCode, STORE_CODE_REGEX } from "@/lib/validators";
import { requireJsonContentType } from "@/lib/csrf";

const bodySchema = z.object({
  code: z.string().min(1).max(16),
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
  const code = normalizeStoreCode(parsed.data.code);
  if (!STORE_CODE_REGEX.test(code)) {
    return NextResponse.json(
      { error: "Store code must be 1–16 chars: A–Z, 0–9, underscore or dash" },
      { status: 400 },
    );
  }
  const name = parsed.data.name.trim();

  try {
    await sql`INSERT INTO stores (id, code, name) VALUES (${newId()}, ${code}, ${name})`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("UNIQUE") || msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ error: `Store code "${code}" already exists` }, { status: 409 });
    }
    return NextResponse.json({ error: "Create failed" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, code });
}
