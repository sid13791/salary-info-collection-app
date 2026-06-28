import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

// Public uptime + keep-alive endpoint, hit hourly by
// .github/workflows/keepalive.yml. It queries a real application table on
// purpose: a bare `SELECT 1` did NOT prevent the Supabase free-tier ~7-day
// idle auto-pause (the project paused twice in Jun 2026 despite a green
// SELECT-1 keep-alive). Touching `packers` (a) counts as genuine activity that
// resets the idle clock, and (b) returns 503 if the schema is missing/empty
// (e.g. mid-restore), so the monitor catches that too — not just a hard outage.
// Response stays minimal ({ok}) since this is unauthenticated: no row counts or
// error details are leaked. force-dynamic ensures the DB is queried every time.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await sql`select count(*) from packers`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
