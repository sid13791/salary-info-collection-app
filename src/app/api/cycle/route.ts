import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase, getServiceRoleSupabase } from "@/lib/supabase/server";
import { MONTH_REGEX } from "@/lib/validators";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("open"), month: z.string().regex(MONTH_REGEX) }),
  z.object({ action: z.literal("close") }),
]);

export async function POST(req: Request) {
  const supabase = getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("app_users").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const sr = getServiceRoleSupabase();

  if (parsed.data.action === "open") {
    const { data: existingOpen } = await sr.from("cycles").select("id").eq("status", "open").maybeSingle();
    if (existingOpen) return NextResponse.json({ error: "A cycle is already open" }, { status: 409 });

    const { error } = await sr.from("cycles").insert({
      month: parsed.data.month,
      status: "open",
      opened_at: new Date().toISOString(),
      opened_by: user.id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await sr.from("audit_log").insert({
      packer_id: null,
      field_changed: "cycle_open",
      old_value: null,
      new_value: parsed.data.month,
      changed_by: user.id,
    });

    return NextResponse.json({ ok: true });
  }

  // close
  const { data: openCycle } = await sr.from("cycles").select("*").eq("status", "open").maybeSingle();
  if (!openCycle) return NextResponse.json({ error: "No open cycle to close" }, { status: 400 });

  // Snapshot active packers into cycle_packers
  const { data: packers } = await sr.from("packers").select("*").eq("is_active", true);
  if (packers && packers.length) {
    const snapshots = packers.map((p) => ({
      cycle_id: openCycle.id,
      packer_id: p.id,
      emp_id: p.emp_id,
      name: p.name,
      store_id: p.store_id,
      bank_account_no: p.bank_account_no,
      ifsc_code: p.ifsc_code,
      phone: p.phone,
      is_active: p.is_active,
    }));
    const { error: snapErr } = await sr.from("cycle_packers").upsert(snapshots, {
      onConflict: "cycle_id,packer_id",
    });
    if (snapErr) return NextResponse.json({ error: snapErr.message }, { status: 500 });
  }

  const { error: closeErr } = await sr
    .from("cycles")
    .update({ status: "closed", closed_at: new Date().toISOString(), closed_by: user.id })
    .eq("id", openCycle.id);
  if (closeErr) return NextResponse.json({ error: closeErr.message }, { status: 500 });

  await sr.from("audit_log").insert({
    packer_id: null,
    field_changed: "cycle_close",
    old_value: openCycle.month,
    new_value: null,
    changed_by: user.id,
  });

  return NextResponse.json({ ok: true, snapshotted: packers?.length ?? 0 });
}
