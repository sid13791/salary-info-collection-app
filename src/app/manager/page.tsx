import { requireManager } from "@/lib/auth";
import { getStoreById, getOpenCycle, getActivePackers } from "@/lib/db";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/Badge";
import { ManagerPackerList } from "./PackerList";

export const dynamic = "force-dynamic";

export default async function ManagerDashboard() {
  const me = await requireManager();
  const store = await getStoreById(me.store_id!);
  const cycle = await getOpenCycle();
  const packers = await getActivePackers(me.store_id!);

  const cycleOpen = !!cycle;
  const missing = packers.filter((p) => p.bank_details_status === "missing").length;

  return (
    <div className="min-h-screen">
      <Header
        title={store?.name ?? "Manager"}
        subtitle={cycle ? `Cycle ${cycle.month} — OPEN` : "No active cycle"}
      />
      <main className="mx-auto max-w-2xl px-3 py-4 space-y-3">
        {!cycleOpen && (
          <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
            <b>No active cycle.</b> Bank details cannot be edited right now.
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="font-medium">{packers.length}</span>{" "}
            <span className="text-muted-foreground">active</span>
            {missing > 0 && (<>{" · "}<Badge variant="warning">{missing} missing</Badge></>)}
          </div>
        </div>

        <ManagerPackerList packers={packers} cycleOpen={cycleOpen} />

        {packers.length === 0 && (
          <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
            No active packers for your store. Ask admin to upload the roster.
          </div>
        )}
      </main>
    </div>
  );
}
