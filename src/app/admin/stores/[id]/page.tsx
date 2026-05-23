import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getStoreById, getActivePackers, getOpenCycle } from "@/lib/db";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/Badge";
import { ManagerPackerList } from "@/app/manager/PackerList";

export const dynamic = "force-dynamic";

export default async function AdminStoreDetail({ params }: { params: { id: string } }) {
  await requireAdmin();
  const store = await getStoreById(params.id);
  if (!store) notFound();
  const cycle = await getOpenCycle();
  const packers = await getActivePackers(store.id);
  const missing = packers.filter((p) => p.bank_details_status === "missing").length;

  return (
    <div className="min-h-screen">
      <Header title={store.name} subtitle={`Store ${store.code} · ${cycle ? `Cycle ${cycle.month} OPEN` : "No active cycle"}`}>
        <Link href="/admin" className="text-sm underline">Dashboard</Link>
        <Link href="/admin/stores" className="text-sm underline">All stores</Link>
      </Header>

      <main className="mx-auto max-w-2xl px-3 py-4 space-y-3">
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

        <ManagerPackerList
          packers={packers}
          cycleOpen={!!cycle}
          editHrefBase={`/admin/stores/${store.id}/packers`}
          lockedWhenClosed={false}
        />

        {packers.length === 0 && (
          <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
            No active packers in this store yet. Upload roster or add one manually.
          </div>
        )}
      </main>
    </div>
  );
}
