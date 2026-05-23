import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";
import { requireJsonContentType } from "@/lib/csrf";

export async function POST(req: Request) {
  const csrfErr = requireJsonContentType(req);
  if (csrfErr) return csrfErr;

  await destroySession();
  return NextResponse.json({ ok: true });
}
