import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getDb, getOpenCycle, getStores, getAllCycles, rows } from "@/lib/db";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/Badge";
import { CycleControls } from "./CycleControls";

export const dynamic = "force-dynamic";

export default function AdminDashboard() {
  requireAdmin();
  const db = getDb();
  const cycle = getOpenCycle();
  const pastCycles = getAllCycles().filter((c) => c.status !== "open");
  const stores = getStores();

  const counts = rows<{ store_id: string; total: number; missing: number; filled: number }>(
    db.prepare(`
      SELECT
        store_id,
        COUNT(*) AS total,
        SUM(CASE WHEN bank_details_status = 'missing' THEN 1 ELSE 0 END) AS missing,
        SUM(CASE WHEN bank_details_status = 'provided' THEN 1 ELSE 0 END) AS filled
      FROM packers
      WHERE is_active = 1
      GROUP BY store_id
    `).all(),
  );
  const countsByStore = new Map(counts.map((c) => [c.store_id, c]));

  const totals = counts.reduce(
    (acc, c) => ({ active: acc.active + c.total, missing: acc.missing + c.missing }),
    { active: 0, missing: 0 },
  );

  return (
    <div className="min-h-screen">
      <Header title="Admin Dashboard" subtitle={cycle ? `Cycle ${cycle.month} OPEN` : "No active cycle"}>
        <Link href="/admin/stores" className="text-sm underline">Stores</Link>
        <Link href="/admin/managers" className="text-sm underline">Managers</Link>
        <Link href="/admin/audit" className="text-sm underline">Audit log</Link>
      </Header>

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <section><CycleControls cycle={cycle} pastCycles={pastCycles} /></section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Active packers" value={totals.active} />
          <Stat label="Stores" value={stores.length} />
          <Stat label="Bank details missing" value={totals.missing} tone={totals.missing > 0 ? "warning" : "default"} />
          <Stat label="Cycle status" value={cycle ? "OPEN" : "CLOSED"} tone={cycle ? "success" : "muted"} />
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Stores</h2>
            <div className="flex gap-2">
              <Link href="/admin/roster" className="text-sm underline">Upload roster</Link>
              <Link href="/admin/packers/new" className="text-sm underline">+ Add packer</Link>
              <Link href="/admin/export" className="text-sm underline">Download export</Link>
            </div>
          </div>
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium text-right">Active</th>
                  <th className="px-3 py-2 font-medium text-right">Filled</th>
                  <th className="px-3 py-2 font-medium text-right">Missing</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((s) => {
                  const c = countsByStore.get(s.id) ?? { total: 0, missing: 0, filled: 0 };
                  return (
                    <tr key={s.id} className="border-t hover:bg-muted/40">
                      <td className="px-3 py-2 font-mono">
                        <Link href={`/admin/stores/${s.id}`} className="underline">{s.code}</Link>
                      </td>
                      <td className="px-3 py-2">
                        <Link href={`/admin/stores/${s.id}`} className="hover:underline">{s.name}</Link>
                      </td>
                      <td className="px-3 py-2 text-right">{c.total}</td>
                      <td className="px-3 py-2 text-right">{c.filled}</td>
                      <td className="px-3 py-2 text-right">
                        {c.missing > 0 ? <Badge variant="warning">{c.missing}</Badge> : <span className="text-muted-foreground">0</span>}
                      </td>
                    </tr>
                  );
                })}
                {stores.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    No stores yet. Add stores via the SQL editor or seed script.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: number | string; tone?: "default" | "success" | "warning" | "muted" }) {
  const toneClass: Record<string, string> = {
    default: "border-border",
    success: "border-success/40 bg-success/5",
    warning: "border-warning/40 bg-warning/5",
    muted: "border-border bg-muted/40",
  };
  return (
    <div className={`rounded-md border p-3 ${toneClass[tone]}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
