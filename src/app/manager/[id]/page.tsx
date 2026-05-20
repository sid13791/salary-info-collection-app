import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { getPackerById, getOpenCycle } from "@/lib/db";
import { Header } from "@/components/Header";
import { EditPackerForm } from "./EditPackerForm";

export const dynamic = "force-dynamic";

export default function EditPackerPage({ params }: { params: { id: string } }) {
  const me = requireManager();
  const packer = getPackerById(params.id);
  if (!packer) notFound();
  if (packer.store_id !== me.store_id) redirect("/manager");
  if (!getOpenCycle()) redirect("/manager");

  return (
    <div className="min-h-screen">
      <Header title={packer.name} subtitle={`Emp ID: ${packer.emp_id}`}>
        <Link href="/manager" className="text-sm underline">Back</Link>
      </Header>
      <main className="mx-auto max-w-md px-3 py-4">
        <EditPackerForm packer={packer} />
      </main>
    </div>
  );
}
