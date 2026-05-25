import { sql, getStores } from "@/lib/db";
import { Badge } from "@/components/ui/Badge";
import { NewManagerForm } from "./NewManagerForm";
import { ReassignManagerStore } from "./ReassignManagerStore";

export const dynamic = "force-dynamic";

interface ManagerRow {
  id: string;
  email: string;
  is_active: number;
  store_id: string | null;
  store_name: string | null;
}

export default async function ManagersPage() {
  const stores = await getStores();
  const managers = [...await sql<ManagerRow[]>`
    SELECT u.id, u.email, u.is_active, u.store_id, s.name AS store_name
    FROM users u
    LEFT JOIN stores s ON s.id = u.store_id
    WHERE u.role = 'manager'
    ORDER BY u.email
  `];

  return (
    <div className="space-y-6">
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
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {managers.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="px-3 py-2">{m.email}</td>
                    <td className="px-3 py-2">{m.store_name ?? "—"}</td>
                    <td className="px-3 py-2">
                      {m.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="muted">Inactive</Badge>}
                    </td>
                    <td className="px-3 py-2">
                      <ReassignManagerStore managerId={m.id} currentStoreId={m.store_id} stores={stores} />
                    </td>
                  </tr>
                ))}
                {managers.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No managers yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
    </div>
  );
}
