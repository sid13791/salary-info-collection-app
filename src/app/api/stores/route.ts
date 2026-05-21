import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRequireAdmin } from "@/lib/auth";
import { getDb, newId } from "@/lib/db";
import { normalizeStoreCode, STORE_CODE_REGEX } from "@/lib/validators";

const bodySchema = z.object({
  code: z.string().min(1).max(16),
  name: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  apiRequireAdmin();
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
    getDb()
      .prepare("INSERT INTO stores (id, code, name) VALUES (?, ?, ?)")
      .run(newId(), code, name);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("UNIQUE") || msg.includes("unique")) {
      return NextResponse.json({ error: `Store code "${code}" already exists` }, { status: 409 });
    }
    return NextResponse.json({ error: msg || "Create failed" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, code });
}
