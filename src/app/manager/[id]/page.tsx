import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { EditPackerForm } from "./EditPackerForm";

export const dynamic = "force-dynamic";

export default async function EditPackerPage({ params }: { params: { id: string } }) {
  const me = await requireManager();
  const supabase = getServerSupabase();

  const { data: packer } = await supabase.from("packers").select("*").eq("id", params.id).maybeSingle();
  if (!packer) notFound();
  if (packer.store_id !== me.store_id) redirect("/manager");

  const { data: cycle } = await supabase.from("cycles").select("*").eq("status", "open").maybeSingle();
  if (!cycle) redirect("/manager");

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
