"use client";

import { useRouter } from "next/navigation";
import type { Packer } from "@/lib/db";
import { ManagerPackerList } from "@/app/manager/PackerList";

export function AdminPackerList({ packers, cycleOpen, storeId }: { packers: Packer[]; cycleOpen: boolean; storeId: string }) {
  const router = useRouter();

  async function handleDelete(packerId: string, packerName: string) {
    if (!confirm(`Permanently delete ${packerName}? This cannot be undone.`)) return;
    const res = await fetch(`/api/packers/${packerId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Delete failed");
      return;
    }
    router.refresh();
  }

  return (
    <ManagerPackerList
      packers={packers}
      cycleOpen={cycleOpen}
      editHrefBase={`/admin/stores/${storeId}/packers`}
      lockedWhenClosed={false}
      onDelete={handleDelete}
    />
  );
}
