import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { NewPackerForm } from "./NewPackerForm";

export const dynamic = "force-dynamic";

export default async function NewPackerPage() {
  await requireAdmin();
  const supabase = getServerSupabase();
  const { data: stores } = await supabase.from("stores").select("id, code, name").order("code");
  const { data: cycle } = await supabase.from("cycles").select("status, month").eq("status", "open").maybeSingle();

  return (
    <div className="min-h-screen">
      <Header title="Add Packer" subtitle={cycle ? `Cycle ${cycle.month} OPEN` : "No active cycle"}>
        <Link href="/admin" className="text-sm underline">Back</Link>
      </Header>
      <main className="mx-auto max-w-xl px-4 py-6">
        <NewPackerForm stores={stores ?? []} cycleOpen={!!cycle} />
      </main>
    </div>
  );
}
