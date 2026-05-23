import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRequireAdmin } from "@/lib/auth";
import { sql, getStores, getOpenCycle, insertAudit, newId } from "@/lib/db";
import { diffRoster, type ExistingPacker } from "@/lib/roster-diff";

const bodySchema = z.object({
  rows: z.array(z.object({ emp_id: z.string(), name: z.string(), store_code: z.string() })),
});

export async function POST(req: Request) {
  const user = await apiRequireAdmin();
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const openCycle = await getOpenCycle();
  if (!openCycle) return NextResponse.json({ error: "No open cycle. Open a cycle first." }, { status: 400 });

  const stores = await getStores();
  const storeCodeToId = new Map(stores.map((s) => [s.code, s.id]));
  const storeIdToCode = new Map(stores.map((s) => [s.id, s.code]));
  const knownStoreCodes = new Set(stores.map((s) => s.code));

  const dbPackers = [...await sql<{ id: string; emp_id: string; name: string; store_id: string; is_active: number }[]>`
    SELECT id, emp_id, name, store_id, is_active FROM packers
  `];

  const existing: ExistingPacker[] = dbPackers.map((p) => ({
    id: p.id,
    emp_id: p.emp_id,
    name: p.name,
    store_id: p.store_id,
    store_code: storeIdToCode.get(p.store_id) ?? "",
    is_active: p.is_active === 1,
  }));

  const diff = diffRoster(existing, parsed.data.rows, knownStoreCodes);
  if (diff.invalidRows.length > 0) {
    return NextResponse.json({ error: "Invalid rows present; cannot commit", details: diff.invalidRows }, { status: 400 });
  }

  let created = 0;
  let reactivated = 0;
  let deactivated = 0;

  try {
    await sql.begin(async (tx) => {
      for (const r of diff.newPackers) {
        await tx`
          INSERT INTO packers (id, emp_id, name, store_id, is_active, bank_details_status)
          VALUES (${newId()}, ${r.emp_id}, ${r.name}, ${storeCodeToId.get(r.store_code)!}, 1, 'missing')
        `;
        created++;
      }
      for (const m of diff.reactivated) {
        await tx`
          UPDATE packers SET is_active = 1, name = ${m.uploaded.name}, updated_at = now()
          WHERE id = ${m.existing.id}
        `;
        reactivated++;
      }
      for (const m of diff.matched) {
        if (m.existing.name !== m.uploaded.name) {
          await tx`
            UPDATE packers SET name = ${m.uploaded.name}, updated_at = now()
            WHERE id = ${m.existing.id}
          `;
        }
      }
      for (const p of diff.deactivated) {
        await tx`
          UPDATE packers SET is_active = 0, updated_at = now()
          WHERE id = ${p.id}
        `;
        deactivated++;
      }
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Commit failed" }, { status: 500 });
  }

  await insertAudit({
    packer_id: null,
    field_changed: "roster_upload",
    old_value: null,
    new_value: JSON.stringify({ cycle: openCycle.month, created, reactivated, deactivated }),
    changed_by: user.id,
  });

  return NextResponse.json({ ok: true, applied: { created, reactivated, deactivated } });
}
