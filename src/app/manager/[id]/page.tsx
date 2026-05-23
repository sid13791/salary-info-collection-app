import { notFound, redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { getPackerById, getOpenCycle } from "@/lib/db";
import { EditPackerForm } from "./EditPackerForm";

export const dynamic = "force-dynamic";

export default async function EditPackerPage({ params }: { params: { id: string } }) {
  const me = await requireManager();
  const packer = await getPackerById(params.id);
  if (!packer) notFound();
  if (packer.store_id !== me.store_id) redirect("/manager");
  if (!(await getOpenCycle())) redirect("/manager");

  return (
    <EditPackerForm packer={packer} />
  );
}
