import { redirect } from "next/navigation";
import { getCurrentUser } from "./session";
import type { User } from "./db";

/** Server-side: return current user or redirect to /login. */
export function requireUser(): User {
  const user = getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function requireAdmin(): User {
  const user = requireUser();
  if (user.role !== "admin") redirect("/manager");
  return user;
}

export function requireManager(): User {
  const user = requireUser();
  if (user.role !== "manager") redirect("/admin");
  return user;
}

/** For API routes — returns user or throws Response. */
export function apiRequireAdmin(): User {
  const user = getCurrentUser();
  if (!user) throw apiError(401, "Unauthorized");
  if (user.role !== "admin") throw apiError(403, "Forbidden");
  return user;
}

export function apiRequireManager(): User {
  const user = getCurrentUser();
  if (!user) throw apiError(401, "Unauthorized");
  if (user.role !== "manager") throw apiError(403, "Forbidden");
  return user;
}

export function apiRequireUser(): User {
  const user = getCurrentUser();
  if (!user) throw apiError(401, "Unauthorized");
  return user;
}

function apiError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
