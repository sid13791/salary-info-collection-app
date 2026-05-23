import Link from "next/link";
import { sql } from "@/lib/db";

interface CyclePackerHistoryRow {
  month: string;
  cycle_id: string;
  bank_account_no: string | null;
  ifsc_code: string | null;
  phone: string | null;
  is_active: number;
  snapshotted_at: string;
}

interface AuditHistoryRow {
  id: number;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  changed_by_email: string | null;
}

export async function PackerHistory({ packerId }: { packerId: string }) {
  const snapshots = [...await sql<CyclePackerHistoryRow[]>`
    SELECT cp.cycle_id, c.month, cp.bank_account_no, cp.ifsc_code, cp.phone,
           cp.is_active, cp.snapshotted_at
    FROM cycle_packers cp
    JOIN cycles c ON c.id = cp.cycle_id
    WHERE cp.packer_id = ${packerId}
    ORDER BY c.month DESC
  `];

  const audits = [...await sql<AuditHistoryRow[]>`
    SELECT al.id, al.field_changed, al.old_value, al.new_value, al.changed_at,
           u.email AS changed_by_email
    FROM audit_log al
    LEFT JOIN users u ON u.id = al.changed_by
    WHERE al.packer_id = ${packerId}
    ORDER BY al.changed_at DESC
    LIMIT 50
  `];

  if (snapshots.length === 0 && audits.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No history yet. History appears here once cycles are closed or edits are made.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold mb-2">Month-wise snapshots</h3>
        {snapshots.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No closed-cycle snapshots yet for this packer.
          </p>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Month</th>
                  <th className="px-2 py-1.5 font-medium">Bank A/C</th>
                  <th className="px-2 py-1.5 font-medium">IFSC</th>
                  <th className="px-2 py-1.5 font-medium">Phone</th>
                  <th className="px-2 py-1.5 font-medium">Active</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s) => (
                  <tr key={s.cycle_id} className="border-t">
                    <td className="px-2 py-1.5 font-mono">
                      <Link href={`/admin/history/${s.month}`} className="underline">
                        {s.month}
                      </Link>
                    </td>
                    <td className="px-2 py-1.5 font-mono">{s.bank_account_no ?? "—"}</td>
                    <td className="px-2 py-1.5 font-mono">{s.ifsc_code ?? "—"}</td>
                    <td className="px-2 py-1.5 font-mono">{s.phone ?? "—"}</td>
                    <td className="px-2 py-1.5">{s.is_active === 1 ? "yes" : "no"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">Edit history</h3>
        {audits.length === 0 ? (
          <p className="text-xs text-muted-foreground">No field edits recorded.</p>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="px-2 py-1.5 font-medium">When</th>
                  <th className="px-2 py-1.5 font-medium">Field</th>
                  <th className="px-2 py-1.5 font-medium">Old → New</th>
                  <th className="px-2 py-1.5 font-medium">By</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((a) => (
                  <tr key={a.id} className="border-t align-top">
                    <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                      {new Date(a.changed_at + "Z").toLocaleString()}
                    </td>
                    <td className="px-2 py-1.5 font-mono">{a.field_changed}</td>
                    <td className="px-2 py-1.5">
                      <span className="text-muted-foreground">{a.old_value ?? "∅"}</span>
                      {" → "}
                      <span>{a.new_value ?? "∅"}</span>
                    </td>
                    <td className="px-2 py-1.5">{a.changed_by_email ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
