import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getPackerById, getStoreById } from "@/lib/db";
import { Header } from "@/components/Header";
import { EditPackerForm } from "@/app/manager/[id]/EditPackerForm";
import { PackerHistory } from "./PackerHistory";

export const dynamic = "force-dynamic";

export default async function AdminEditPackerPage({
  params,
}: {
  params: { id: string; packerId: string };
}) {
  await requireAdmin();
  const packer = await getPackerById(params.packerId);
  if (!packer) notFound();
  // Verify the packer actually belongs to the store in the URL — keeps URLs honest
  if (packer.store_id !== params.id) redirect(`/admin/stores/${packer.store_id}`);

  const store = await getStoreById(packer.store_id);

  const backHref = `/admin/stores/${packer.store_id}`;
  return (
    <div className="min-h-screen">
      <Header title={packer.name} subtitle={`${store?.code ?? ""} · Emp ID ${packer.emp_id}`}>
        <Link href={backHref} className="text-sm underline">Back</Link>
      </Header>
      <main className="mx-auto max-w-3xl px-3 py-4 space-y-8">
        <div className="max-w-md">
          <EditPackerForm packer={packer} backHref={backHref} />
        </div>
        <section className="border-t pt-6">
          <h2 className="font-semibold mb-3">History</h2>
          <PackerHistory packerId={packer.id} />
        </section>
      </main>
    </div>
  );
}
