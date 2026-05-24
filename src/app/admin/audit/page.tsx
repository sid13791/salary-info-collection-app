import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

interface AuditRow {
  id: number;
  packer_id: string | null;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
  emp_id: string | null;
  packer_name: string | null;
  store_name: string | null;
  changed_by_email: string | null;
}

export default async function AuditLogPage() {
  const logs = [...await sql<AuditRow[]>`
    SELECT
      al.*,
      p.emp_id        AS emp_id,
      p.name          AS packer_name,
      s.name          AS store_name,
      u.email         AS changed_by_email
    FROM audit_log al
    LEFT JOIN packers p ON p.id = al.packer_id
    LEFT JOIN stores  s ON s.id = p.store_id
    LEFT JOIN users   u ON u.id = al.changed_by
    ORDER BY al.changed_at DESC
    LIMIT 200
  `];

  return (
    <div>
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
              {logs.map((l) => (
                <tr key={l.id} className="border-t align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(l.changed_at + "Z").toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    {l.emp_id ? <><span className="font-mono">{l.emp_id}</span> — {l.packer_name}</> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2">{l.store_name ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{l.field_changed}</td>
                  <td className="px-3 py-2 text-xs">
                    <span className="text-muted-foreground">{l.old_value ?? "∅"}</span>
                    {" → "}
                    <span>{l.new_value ?? "∅"}</span>
                  </td>
                  <td className="px-3 py-2 text-xs">{l.changed_by_email ?? l.changed_by ?? "—"}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No audit entries yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
    </div>
  );
}
