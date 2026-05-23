import { notFound } from "next/navigation";
import { sql, getStores, type Cycle } from "@/lib/db";
import { MONTH_REGEX } from "@/lib/validators";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

interface SnapshotRow {
  id: string;
  packer_id: string;
  emp_id: string;
  name: string;
  store_id: string;
  bank_account_no: string | null;
  ifsc_code: string | null;
  phone: string | null;
  is_active: number;
}

export default async function HistoryMonthPage({ params }: { params: { month: string } }) {
  if (!MONTH_REGEX.test(params.month)) notFound();

  const cycle = (await sql<Cycle[]>`
    SELECT * FROM cycles WHERE month = ${params.month} AND status = 'closed'
  `)[0] ?? null;
  if (!cycle) notFound();

  const snapshot = [...await sql<SnapshotRow[]>`
    SELECT *
    FROM cycle_packers
    WHERE cycle_id = ${cycle.id}
    ORDER BY store_id, emp_id
  `];

  const stores = await getStores();
  const storeById = new Map(stores.map((s) => [s.id, s]));

  const activeCount = snapshot.filter((p) => p.is_active === 1).length;
  const filledCount = snapshot.filter(
    (p) => p.is_active === 1 && p.bank_account_no && p.ifsc_code,
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {cycle.closed_at ? `Closed ${new Date(cycle.closed_at + "Z").toLocaleString()}` : ""}
        </p>
        <a
          href={`/api/export?month=${cycle.month}`}
          className="text-sm underline"
        >
          Download export
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat label="Snapshotted packers" value={snapshot.length} />
          <Stat label="Active at close" value={activeCount} />
          <Stat label="With bank details" value={filledCount} />
        </div>

        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Emp ID</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Store</th>
                <th className="px-3 py-2 font-medium">Bank A/C</th>
                <th className="px-3 py-2 font-medium">IFSC</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.map((p) => {
                const store = storeById.get(p.store_id);
                const filled = p.bank_account_no && p.ifsc_code;
                return (
                  <tr key={p.id} className="border-t align-top">
                    <td className="px-3 py-2 font-mono text-xs">{p.emp_id}</td>
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2 font-mono text-xs">{store?.code ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.bank_account_no ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.ifsc_code ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.phone ?? "—"}</td>
                    <td className="px-3 py-2">
                      {p.is_active !== 1 ? (
                        <Badge variant="muted">inactive</Badge>
                      ) : filled ? (
                        <Badge variant="success">filled</Badge>
                      ) : (
                        <Badge variant="warning">missing</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
              {snapshot.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                    Snapshot is empty for this cycle.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
