import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getDb, getStores, rows } from "@/lib/db";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/Badge";
import { NewManagerForm } from "./NewManagerForm";

export const dynamic = "force-dynamic";

interface ManagerRow {
  id: string;
  email: string;
  is_active: number;
  store_code: string | null;
  store_name: string | null;
}

export default function ManagersPage() {
  requireAdmin();
  const stores = getStores();
  const managers = rows<ManagerRow>(
    getDb()
      .prepare(`
        SELECT u.id, u.email, u.is_active, s.code AS store_code, s.name AS store_name
        FROM users u
        LEFT JOIN stores s ON s.id = u.store_id
        WHERE u.role = 'manager'
        ORDER BY u.email
      `)
      .all(),
  );

  return (
    <div className="min-h-screen">
      <Header title="Managers">
        <Link href="/admin" className="text-sm underline">Back</Link>
      </Header>
      <main className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        <section className="rounded-md border p-4">
          <h2 className="font-semibold mb-3">Add manager</h2>
          <NewManagerForm stores={stores} />
        </section>
        <section>
          <h2 className="font-semibold mb-2">Existing managers</h2>
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Store</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {managers.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="px-3 py-2">{m.email}</td>
                    <td className="px-3 py-2">{m.store_code ? `${m.store_code} — ${m.store_name}` : "—"}</td>
                    <td className="px-3 py-2">
                      {m.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="muted">Inactive</Badge>}
                    </td>
                  </tr>
                ))}
                {managers.length === 0 && (
                  <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">No managers yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
