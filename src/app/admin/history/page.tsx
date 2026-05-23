import Link from "next/link";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

interface ClosedCycleRow {
  id: string;
  month: string;
  closed_at: string | null;
  closed_by_email: string | null;
  total: number;
  active: number;
  filled: number;
}

export default async function HistoryListPage() {
  const cycles = [...await sql<ClosedCycleRow[]>`
    SELECT
      c.id,
      c.month,
      c.closed_at,
      u.email AS closed_by_email,
      COALESCE(COUNT(cp.id), 0)::int AS total,
      COALESCE(SUM(CASE WHEN cp.is_active = 1 THEN 1 ELSE 0 END), 0)::int AS active,
      COALESCE(SUM(CASE WHEN cp.is_active = 1
                          AND cp.bank_account_no IS NOT NULL
                          AND cp.ifsc_code IS NOT NULL
                        THEN 1 ELSE 0 END), 0)::int AS filled
    FROM cycles c
    LEFT JOIN cycle_packers cp ON cp.cycle_id = c.id
    LEFT JOIN users u ON u.id = c.closed_by
    WHERE c.status = 'closed'
    GROUP BY c.id, u.email
    ORDER BY c.month DESC
  `];

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
          Frozen snapshots taken when each cycle was closed. Bank details shown reflect the state at close.
        </p>
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Month</th>
                <th className="px-3 py-2 font-medium">Closed</th>
                <th className="px-3 py-2 font-medium">By</th>
                <th className="px-3 py-2 font-medium text-right">Active packers</th>
                <th className="px-3 py-2 font-medium text-right">With bank details</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/40">
                  <td className="px-3 py-2 font-mono">
                    <Link href={`/admin/history/${c.month}`} className="underline">{c.month}</Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {c.closed_at ? new Date(c.closed_at + "Z").toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">{c.closed_by_email ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{c.active}</td>
                  <td className="px-3 py-2 text-right">{c.filled}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/admin/history/${c.month}`} className="text-xs underline">View →</Link>
                  </td>
                </tr>
              ))}
              {cycles.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    No closed cycles yet. History appears here once a cycle is closed.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
    </div>
  );
}
