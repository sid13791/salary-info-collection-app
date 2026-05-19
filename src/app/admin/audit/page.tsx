import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { Header } from "@/components/Header";

export const dynamic = "force-dynamic";

export default async function AuditLogPage({ searchParams }: { searchParams: { store?: string; emp?: string } }) {
  await requireAdmin();
  const supabase = getServerSupabase();

  let query = supabase
    .from("audit_log")
    .select("*, packers(emp_id, name, store_id), app_users!audit_log_changed_by_fkey(email)")
    .order("changed_at", { ascending: false })
    .limit(200);

  // Filter by emp_id by joining packers
  // (For simplicity, basic filters; richer filters can be added later)
  const { data: logs } = await query;
  const { data: stores } = await supabase.from("stores").select("id, code, name");
  const storeById = new Map((stores ?? []).map((s) => [s.id, s]));

  return (
    <div className="min-h-screen">
      <Header title="Audit Log">
        <Link href="/admin" className="text-sm underline">Back</Link>
      </Header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="px-3 py-2 font-medium whitespace-nowrap">When</th>
                <th className="px-3 py-2 font-medium">Packer</th>
                <th className="px-3 py-2 font-medium">Store</th>
                <th className="px-3 py-2 font-medium">Field</th>
                <th className="px-3 py-2 font-medium">Old → New</th>
                <th className="px-3 py-2 font-medium">By</th>
              </tr>
            </thead>
            <tbody>
              {(logs ?? []).map((l) => {
                const pk = l.packers as { emp_id?: string; name?: string; store_id?: string } | null;
                const byEmail = (l.app_users as { email?: string } | null)?.email;
                const store = pk?.store_id ? storeById.get(pk.store_id) : null;
                return (
                  <tr key={l.id} className="border-t align-top">
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(l.changed_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      {pk ? <><span className="font-mono">{pk.emp_id}</span> — {pk.name}</> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2">{store?.code ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{l.field_changed}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className="text-muted-foreground">{l.old_value ?? "∅"}</span>
                      {" → "}
                      <span>{l.new_value ?? "∅"}</span>
                    </td>
                    <td className="px-3 py-2 text-xs">{byEmail ?? l.changed_by ?? "—"}</td>
                  </tr>
                );
              })}
              {(logs ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    No audit entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
