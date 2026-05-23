import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getStores, getOpenCycle } from "@/lib/db";
import { Header } from "@/components/Header";
import { RosterUploader } from "./RosterUploader";

export const dynamic = "force-dynamic";

export default async function RosterUploadPage() {
  await requireAdmin();
  const stores = await getStores();
  const cycle = await getOpenCycle();

  return (
    <div className="min-h-screen">
      <Header title="Add Packers" subtitle="Upload a roster or add individually">
        <Link href="/admin" className="text-sm underline">Back</Link>
      </Header>
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Upload an <code className="bg-muted px-1 rounded">.xlsx</code> with columns: <b>emp_id</b>, <b>name</b>, <b>store_code</b>.
          </p>
          <a
            href="/api/roster/template"
            download
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted transition"
          >
            Download template
          </a>
        </div>
        <RosterUploader stores={stores} cycleOpen={!!cycle} />
      </main>
    </div>
  );
}
