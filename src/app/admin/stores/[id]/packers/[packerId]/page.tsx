import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPackerById, getStoreById } from "@/lib/db";
import { EditPackerForm } from "@/app/manager/[id]/EditPackerForm";
import { PackerHistory } from "./PackerHistory";

export const dynamic = "force-dynamic";

export default async function AdminEditPackerPage({
  params,
}: {
  params: { id: string; packerId: string };
}) {
  const packer = await getPackerById(params.packerId);
  if (!packer) notFound();
  // Verify the packer actually belongs to the store in the URL — keeps URLs honest
  if (packer.store_id !== params.id) redirect(`/admin/stores/${packer.store_id}`);

  const store = await getStoreById(packer.store_id);

  const backHref = `/admin/stores/${packer.store_id}`;
  return (
    <div className="space-y-8">
      <Link href={backHref} className="text-sm text-muted-foreground hover:underline">← Back to store</Link>
      <div className="max-w-md">
        <EditPackerForm packer={packer} backHref={backHref} />
      </div>
      <section className="border-t pt-6">
        <h2 className="font-semibold mb-3">History</h2>
        <PackerHistory packerId={packer.id} />
      </section>
    </div>
  );
}
