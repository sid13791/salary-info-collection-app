import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRequireAdmin } from "@/lib/auth";
import { sql, getStores } from "@/lib/db";
import { diffRoster, type ExistingPacker } from "@/lib/roster-diff";
import { requireJsonContentType } from "@/lib/csrf";

const bodySchema = z.object({
  rows: z.array(z.object({ emp_id: z.string(), name: z.string(), store_name: z.string(), packman_status: z.string(), current_role_name: z.string().optional().default("") })),
  targetStore: z.string().min(1, "Target store is required"),
});

export async function POST(req: Request) {
  const csrfErr = requireJsonContentType(req);
  if (csrfErr) return csrfErr;

  await apiRequireAdmin();
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const stores = await getStores();
  const storeIdToName = new Map(stores.map((s) => [s.id, s.name]));
  const knownStoreNames = new Set(stores.map((s) => s.name));

  const targetStore = parsed.data.targetStore.trim();
  if (!knownStoreNames.has(targetStore)) {
    return NextResponse.json({ error: `Unknown target store "${targetStore}"` }, { status: 400 });
  }

  // Split uploaded rows: valid (matching target store) vs mismatched (other stores)
  const validRows = parsed.data.rows.filter((r) => r.store_name.trim() === targetStore);
  const mismatchedRows = parsed.data.rows.filter((r) => r.store_name.trim() !== targetStore);

  const dbPackers = [...await sql<{ id: string; emp_id: string; name: string; store_id: string; is_active: number }[]>`
    SELECT id, emp_id, name, store_id, is_active FROM packers
  `];

  const existing: ExistingPacker[] = dbPackers
    .map((p) => ({
      id: p.id,
      emp_id: p.emp_id,
      name: p.name,
      store_id: p.store_id,
      store_name: storeIdToName.get(p.store_id) ?? "",
      is_active: p.is_active === 1,
    }))
    .filter((p) => p.store_name === targetStore);

  const diff = diffRoster(existing, validRows, knownStoreNames);

  return NextResponse.json({
    diff: {
      matched: diff.matched.map((m) => ({ emp_id: m.uploaded.emp_id, name: m.uploaded.name, store_name: m.uploaded.store_name })),
      newPackers: diff.newPackers.map((p) => ({ emp_id: p.emp_id, name: p.name, store_name: p.store_name })),
      reactivated: diff.reactivated.map((m) => ({ emp_id: m.uploaded.emp_id, name: m.uploaded.name, store_name: m.uploaded.store_name })),
      deactivated: diff.deactivated.map((p) => ({ emp_id: p.emp_id, name: p.name, store_name: p.store_name })),
      storeMigrations: diff.storeMigrations.map((m) => ({
        emp_id: m.uploaded.emp_id,
        from: m.existing.store_name,
        to: m.uploaded.store_name,
      })),
      invalidRows: diff.invalidRows.map((r) => ({ rowIndex: r.rowIndex, reason: r.reason })),
      mismatchedRows: mismatchedRows.map((r) => ({ emp_id: r.emp_id, name: r.name, store_name: r.store_name })),
    },
  });
}
