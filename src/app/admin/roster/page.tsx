import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Header } from "@/components/Header";
import { RosterUploader } from "./RosterUploader";

export const dynamic = "force-dynamic";

export default function RosterUploadPage() {
  requireAdmin();
  return (
    <div className="min-h-screen">
      <Header title="Upload Roster" subtitle="Replaces inactive flags + adds new packers">
        <Link href="/admin" className="text-sm underline">Back</Link>
      </Header>
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Upload an <code className="bg-muted px-1 rounded">.xlsx</code> with columns: <b>emp_id</b>, <b>name</b>, <b>store_code</b>.{" "}
          <Link href="/api/roster/template" className="underline">Download template</Link>
        </p>
        <RosterUploader />
      </main>
    </div>
  );
}
