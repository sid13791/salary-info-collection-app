import Link from "next/link";
import { notFound } from "next/navigation";
import { getStoreById, getActivePackers, getOpenCycle } from "@/lib/db";
import { Badge } from "@/components/ui/Badge";
import { AdminPackerList } from "./AdminPackerList";

export const dynamic = "force-dynamic";

export default async function AdminStoreDetail({ params }: { params: { id: string } }) {
  const store = await getStoreById(params.id);
  if (!store) notFound();
  const cycle = await getOpenCycle();
  const packers = await getActivePackers(store.id);
  const missing = packers.filter((p) => p.bank_details_status === "missing").length;

  return (
    <div className="space-y-3">
      <Link href="/admin/stores" className="text-sm text-muted-foreground hover:underline">← All stores</Link>

      {!cycle && (
          <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
            <b>No active cycle.</b> Admins can still edit, but normally bank details are filled during an open cycle.
          </div>
        )}

        <div className="text-sm">
          <span className="font-medium">{packers.length}</span>{" "}
          <span className="text-muted-foreground">active</span>
          {missing > 0 && (<>{" · "}<Badge variant="warning">{missing} missing</Badge></>)}
        </div>

        <AdminPackerList
          packers={packers}
          cycleOpen={!!cycle}
          storeId={store.id}
        />

        {packers.length === 0 && (
          <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
            No active packers in this store yet. Upload roster or add one manually.
          </div>
        )}
    </div>
  );
}
