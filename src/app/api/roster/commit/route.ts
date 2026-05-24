import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRequireAdmin } from "@/lib/auth";
import { sql, getStores, getOpenCycle, insertAudit, newId } from "@/lib/db";
import { diffRoster, type ExistingPacker } from "@/lib/roster-diff";
import { requireJsonContentType } from "@/lib/csrf";

const bodySchema = z.object({
  rows: z.array(z.object({ emp_id: z.string(), name: z.string(), store_name: z.string(), packman_status: z.string() })),
});

export async function POST(req: Request) {
  const csrfErr = requireJsonContentType(req);
  if (csrfErr) return csrfErr;

  const user = await apiRequireAdmin();
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const openCycle = await getOpenCycle();
  if (!openCycle) return NextResponse.json({ error: "No open cycle. Open a cycle first." }, { status: 400 });

  const stores = await getStores();
  const storeNameToId = new Map(stores.map((s) => [s.name, s.id]));
  const storeIdToName = new Map(stores.map((s) => [s.id, s.name]));
  const knownStoreNames = new Set(stores.map((s) => s.name));

  const dbPackers = [...await sql<{ id: string; emp_id: string; name: string; store_id: string; is_active: number }[]>`
    SELECT id, emp_id, name, store_id, is_active FROM packers
  `];

  const existing: ExistingPacker[] = dbPackers.map((p) => ({
    id: p.id,
    emp_id: p.emp_id,
    name: p.name,
    store_id: p.store_id,
    store_name: storeIdToName.get(p.store_id) ?? "",
    is_active: p.is_active === 1,
  }));

  const diff = diffRoster(existing, parsed.data.rows, knownStoreNames);
  if (diff.invalidRows.length > 0) {
    return NextResponse.json({ error: "Invalid rows present; cannot commit", details: diff.invalidRows }, { status: 400 });
  }

  // Reject if store migrations exist — these need manual resolution
  if (diff.storeMigrations.length > 0) {
    return NextResponse.json({
      error: "Store migrations detected — resolve manually before committing",
      details: diff.storeMigrations.map((m) => ({
        emp_id: m.uploaded.emp_id,
        from: m.existing.store_name,
        to: m.uploaded.store_name,
      })),
    }, { status: 400 });
  }

  let created = 0;
  let reactivated = 0;
  let deactivated = 0;

  try {
    await sql.begin(async (tx) => {
      for (const r of diff.newPackers) {
        const sid = storeNameToId.get(r.store_name);
        if (!sid) throw new Error(`Store not found: ${r.store_name}`);
        const active = r.packman_status !== "INACTIVE" ? 1 : 0;
        await tx`
          INSERT INTO packers (id, emp_id, name, store_id, is_active, bank_details_status)
          VALUES (${newId()}, ${r.emp_id}, ${r.name}, ${sid}, ${active}, 'missing')
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
    return NextResponse.json({ error: "Commit failed" }, { status: 500 });
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
