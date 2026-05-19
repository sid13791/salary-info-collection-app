import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/supabase/types";

/** Server-side: fetch current app user or redirect to /login. */
export async function requireUser(): Promise<AppUser> {
  const supabase = getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    redirect("/login");
  }
  return profile;
}

export async function requireAdmin(): Promise<AppUser> {
  const profile = await requireUser();
  if (profile.role !== "admin") redirect("/manager");
  return profile;
}

export async function requireManager(): Promise<AppUser> {
  const profile = await requireUser();
  if (profile.role !== "manager") redirect("/admin");
  return profile;
}
