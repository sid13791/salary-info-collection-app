import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getStores, getOpenCycle } from "@/lib/db";
import { Header } from "@/components/Header";
import { NewPackerForm } from "./NewPackerForm";

export const dynamic = "force-dynamic";

export default function NewPackerPage() {
  requireAdmin();
  const stores = getStores();
  const cycle = getOpenCycle();
  return (
    <div className="min-h-screen">
      <Header title="Add Packer" subtitle={cycle ? `Cycle ${cycle.month} OPEN` : "No active cycle"}>
        <Link href="/admin" className="text-sm underline">Back</Link>
      </Header>
      <main className="mx-auto max-w-xl px-4 py-6">
        <NewPackerForm stores={stores} cycleOpen={!!cycle} />
      </main>
    </div>
  );
}
