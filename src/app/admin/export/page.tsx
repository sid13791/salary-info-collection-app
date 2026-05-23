import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Header } from "@/components/Header";

export const dynamic = "force-dynamic";

export default async function ExportPage() {
  await requireAdmin();
  return (
    <div className="min-h-screen">
      <Header title="Bank Export">
        <Link href="/admin" className="text-sm underline">Back</Link>
      </Header>
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Downloads bank details for the latest closed cycle (or current live data if no cycle has closed yet).
          The Amount column is blank — fill it from payroll before uploading to ICICI.
        </p>
        <a
          href="/api/export"
          className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-10 px-4 text-sm font-medium hover:bg-primary/90"
          download
        >
          Download bank export (.xlsx)
        </a>
      </main>
    </div>
  );
}
