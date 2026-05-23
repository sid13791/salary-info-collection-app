import { NextResponse } from "next/server";

/**
 * Reject requests without application/json content-type.
 * Blocks cross-site form POST attacks (CSRF) since HTML forms
 * cannot set content-type to application/json.
 * Returns a 415 response if invalid, or null if OK.
 */
export function requireJsonContentType(req: Request): NextResponse | null {
  const ct = req.headers.get("content-type");
  if (!ct || !ct.includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 },
    );
  }
  return null;
}
