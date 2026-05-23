import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { getStoreById } from "@/lib/db";
import { Header } from "@/components/Header";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireManager();
  if (!user.store_id) redirect("/login");
  const store = await getStoreById(user.store_id);

  return (
    <div className="min-h-screen">
      <Header
        title="Salary Info Collection"
        subtitle={store?.name ?? "My Store"}
      />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
