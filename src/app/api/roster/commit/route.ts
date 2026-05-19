import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase, getServiceRoleSupabase } from "@/lib/supabase/server";
import { diffRoster, type ExistingPacker } from "@/lib/roster-diff";

const bodySchema = z.object({
  rows: z.array(z.object({
    emp_id: z.string(),
    name: z.string(),
    store_code: z.string(),
  })),
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

  // Require an open cycle
  const { data: openCycle } = await sr.from("cycles").select("id, month").eq("status", "open").maybeSingle();
  if (!openCycle) return NextResponse.json({ error: "No open cycle. Open a cycle first." }, { status: 400 });

  const { data: stores } = await sr.from("stores").select("id, code");
  const storeCodeToId = new Map((stores ?? []).map((s) => [s.code, s.id]));
  const storeIdToCode = new Map((stores ?? []).map((s) => [s.id, s.code]));
  const knownStoreCodes = new Set(storeCodeToId.keys());

  const { data: dbPackers } = await sr.from("packers").select("id, emp_id, name, store_id, is_active");
  const existing: ExistingPacker[] = (dbPackers ?? []).map((p) => ({
    id: p.id,
    emp_id: p.emp_id,
    name: p.name,
    store_id: p.store_id,
    store_code: storeIdToCode.get(p.store_id) ?? "",
    is_active: p.is_active,
  }));

  const diff = diffRoster(existing, parsed.data.rows, knownStoreCodes);
  if (diff.invalidRows.length > 0) {
    return NextResponse.json({ error: "Invalid rows present; cannot commit", details: diff.invalidRows }, { status: 400 });
  }

  let created = 0;
  let reactivated = 0;
  let deactivated = 0;

  // Insert new packers
  if (diff.newPackers.length) {
    const inserts = diff.newPackers.map((r) => ({
      emp_id: r.emp_id,
      name: r.name,
      store_id: storeCodeToId.get(r.store_code)!,
      is_active: true,
    }));
    const { error } = await sr.from("packers").insert(inserts);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    created = inserts.length;
  }

  // Reactivate
  for (const m of diff.reactivated) {
    const { error } = await sr.from("packers")
      .update({ is_active: true, name: m.uploaded.name })
      .eq("id", m.existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    reactivated += 1;
  }

  // Update matched (only name; bank fields preserved)
  for (const m of diff.matched) {
    if (m.existing.name !== m.uploaded.name) {
      await sr.from("packers").update({ name: m.uploaded.name }).eq("id", m.existing.id);
    }
  }

  // Deactivate
  for (const p of diff.deactivated) {
    const { error } = await sr.from("packers").update({ is_active: false }).eq("id", p.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    deactivated += 1;
  }

  // Synthetic audit entry for the roster upload event
  await sr.from("audit_log").insert({
    packer_id: null,
    field_changed: "roster_upload",
    old_value: null,
    new_value: JSON.stringify({ cycle: openCycle.month, created, reactivated, deactivated }),
    changed_by: user.id,
  });

  return NextResponse.json({ ok: true, applied: { created, reactivated, deactivated } });
}
