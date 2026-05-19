import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/Badge";
import { CycleControls } from "./CycleControls";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await requireAdmin();
  const supabase = getServerSupabase();

  const [{ data: cycle }, { data: stores }, { count: activePackers }, { count: missing }] = await Promise.all([
    supabase.from("cycles").select("*").eq("status", "open").maybeSingle(),
    supabase.from("stores").select("*").order("code"),
    supabase.from("packers").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("packers").select("*", { count: "exact", head: true })
      .eq("is_active", true).eq("bank_details_status", "missing"),
  ]);

  // Per-store counts
  const { data: perStore } = await supabase
    .from("packers")
    .select("store_id, is_active, bank_details_status");

  const counts = new Map<string, { total: number; missing: number; filled: number }>();
  for (const p of perStore ?? []) {
    if (!p.is_active) continue;
    const c = counts.get(p.store_id) ?? { total: 0, missing: 0, filled: 0 };
    c.total += 1;
    if (p.bank_details_status === "missing") c.missing += 1;
    else c.filled += 1;
    counts.set(p.store_id, c);
  }

  return (
    <div className="min-h-screen">
      <Header title="Admin Dashboard" subtitle={cycle ? `Cycle ${cycle.month} OPEN` : "No active cycle"}>
        <Link href="/admin/audit" className="text-sm underline">Audit log</Link>
        <Link href="/admin/managers" className="text-sm underline">Managers</Link>
      </Header>

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <section>
          <CycleControls cycle={cycle} />
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Active packers" value={activePackers ?? 0} />
          <Stat label="Stores" value={stores?.length ?? 0} />
          <Stat label="Bank details missing" value={missing ?? 0} tone={missing && missing > 0 ? "warning" : "default"} />
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
                {(stores ?? []).map((s) => {
                  const c = counts.get(s.id) ?? { total: 0, missing: 0, filled: 0 };
                  return (
                    <tr key={s.id} className="border-t">
                      <td className="px-3 py-2 font-mono">{s.code}</td>
                      <td className="px-3 py-2">{s.name}</td>
                      <td className="px-3 py-2 text-right">{c.total}</td>
                      <td className="px-3 py-2 text-right">{c.filled}</td>
                      <td className="px-3 py-2 text-right">
                        {c.missing > 0 ? (
                          <Badge variant="warning">{c.missing}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {(stores ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      No stores yet. Add stores via the SQL editor or seed file.
                    </td>
                  </tr>
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
