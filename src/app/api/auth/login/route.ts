import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserByEmail } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { requireJsonContentType } from "@/lib/csrf";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Simple in-memory rate limiter: max 5 failed attempts per email per 15 minutes
const failedAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  const csrfErr = requireJsonContentType(req);
  if (csrfErr) return csrfErr;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const email = parsed.data.email.toLowerCase().trim();

  // Rate limit check
  const now = Date.now();
  const entry = failedAttempts.get(email);
  if (entry && entry.count >= MAX_ATTEMPTS && now < entry.resetAt) {
    return NextResponse.json(
      { error: "Too many failed attempts. Try again later." },
      { status: 429 },
    );
  }

  const user = await getUserByEmail(email);
  if (!user || !user.is_active) {
    trackFailure(email, now);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  if (!verifyPassword(parsed.data.password, user.password_hash)) {
    trackFailure(email, now);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Success — clear rate limit
  failedAttempts.delete(email);

  await createSession(user.id);
  return NextResponse.json({
    ok: true,
    role: user.role,
    must_change_password: !!user.must_change_password,
  });
}

function trackFailure(email: string, now: number): void {
  const entry = failedAttempts.get(email);
  if (!entry || now >= entry.resetAt) {
    failedAttempts.set(email, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count++;
  }
}
