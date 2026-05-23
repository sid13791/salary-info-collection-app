import { redirect } from "next/navigation";
import { getCurrentUser } from "./session";
import type { User } from "./db";

/** Server-side: return current user or redirect to /login. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/manager");
  return user;
}

export async function requireManager(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "manager") redirect("/admin");
  return user;
}

/** For API routes — returns user or throws Response. */
export async function apiRequireAdmin(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw apiError(401, "Unauthorized");
  if (user.role !== "admin") throw apiError(403, "Forbidden");
  return user;
}

export async function apiRequireManager(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw apiError(401, "Unauthorized");
  if (user.role !== "manager") throw apiError(403, "Forbidden");
  return user;
}

export async function apiRequireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw apiError(401, "Unauthorized");
  return user;
}

function apiError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
