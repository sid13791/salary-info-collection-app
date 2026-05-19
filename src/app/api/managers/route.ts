import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase, getServiceRoleSupabase } from "@/lib/supabase/server";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  store_id: z.string().uuid(),
});

export async function POST(req: Request) {
  const supabase = getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("app_users").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const sr = getServiceRoleSupabase();

  // Create the auth user
  const { data: created, error: createErr } = await sr.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    return NextResponse.json({ error: createErr?.message ?? "Auth create failed" }, { status: 400 });
  }

  // Create the app_users profile linking to the new auth user
  const { error: profileErr } = await sr.from("app_users").insert({
    id: created.user.id,
    email: parsed.data.email,
    role: "manager",
    store_id: parsed.data.store_id,
    is_active: true,
    must_change_password: true,
  });
  if (profileErr) {
    // best-effort cleanup
    await sr.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: profileErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
