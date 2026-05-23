import Link from "next/link";
import { sql } from "@/lib/db";
import { NewStoreForm } from "./NewStoreForm";
import { DeleteStoreButton } from "./DeleteStoreButton";

export const dynamic = "force-dynamic";

interface StoreRow {
  id: string;
  code: string;
  name: string;
  active_packers: number;
}

export default async function StoresPage() {
  // Counts of active packers per store, joined in one query
  const rows = [...await sql<StoreRow[]>`
    SELECT s.id, s.code, s.name,
      (SELECT COUNT(*)::int FROM packers p WHERE p.store_id = s.id AND p.is_active = 1) AS active_packers
    FROM stores s
    ORDER BY s.code
  `];

  return (
    <div className="space-y-6">
      <section className="rounded-md border p-4">
          <h2 className="font-semibold mb-3">Add store</h2>
          <NewStoreForm />
          <p className="text-xs text-muted-foreground mt-2">
            <b>Code</b> is the short identifier used in the roster Excel (e.g. <code>NCR01</code>).
            <b className="ml-2">Name</b> is the friendly display name (e.g. <code>Delhi – Connaught Place</code>).
          </p>
        </section>

        <section>
          <h2 className="font-semibold mb-2">Existing stores ({rows.length})</h2>
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium text-right">Active packers</th>
                  <th className="px-3 py-2 font-medium text-right w-20"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-t hover:bg-muted/40">
                    <td className="px-3 py-2 font-mono">
                      <Link href={`/admin/stores/${s.id}`} className="underline">{s.code}</Link>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/admin/stores/${s.id}`} className="hover:underline">{s.name}</Link>
                    </td>
                    <td className="px-3 py-2 text-right">{s.active_packers}</td>
                    <td className="px-3 py-2 text-right">
                      <DeleteStoreButton storeId={s.id} storeCode={s.code} />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                      No stores yet. Add one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
    </div>
  );
}
