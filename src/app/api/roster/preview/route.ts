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

  return NextResponse.json({
    diff: {
      matched: diff.matched.length,
      newPackers: diff.newPackers,
      reactivated: diff.reactivated.length,
      deactivated: diff.deactivated.map((p) => ({ emp_id: p.emp_id, name: p.name, store_code: p.store_code })),
      storeMigrations: diff.storeMigrations.map((m) => ({
        emp_id: m.uploaded.emp_id,
        from: m.existing.store_code,
        to: m.uploaded.store_code,
      })),
      invalidRows: diff.invalidRows.map((r) => ({ rowIndex: r.rowIndex, reason: r.reason })),
    },
  });
}
