import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "salary_session";

/**
 * Defense-in-depth middleware: redirect unauthenticated users away
 * from protected routes. Individual pages/API routes still perform
 * their own auth checks — this is an additional layer.
 */
export function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    const { pathname } = req.nextUrl;

    // API routes: return 401 JSON
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Page routes: redirect to login
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/manager/:path*", "/api/((?!auth/).*)"],
};
