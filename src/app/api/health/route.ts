import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

// Public endpoint. A scheduled keep-alive (.github/workflows/keepalive.yml)
// pings this every few days so the Supabase free-tier project never hits the
// ~7-day idle auto-pause. force-dynamic ensures the DB is actually queried on
// every request instead of serving a cached response.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await sql`select 1 as ok`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
