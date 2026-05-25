"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Packer, Store } from "@/lib/db";
import { ManagerPackerList } from "@/app/manager/PackerList";

export function AdminPackerList({
  packers,
  cycleOpen,
  storeId,
  otherStores,
}: {
  packers: Packer[];
  cycleOpen: boolean;
  storeId: string;
  otherStores: Pick<Store, "id" | "name">[];
}) {
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

  async function handleMove(packerId: string, packerName: string, targetStoreId: string) {
    const res = await fetch(`/api/packers/${packerId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ store_id: targetStoreId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Move failed");
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
      onMove={otherStores.length > 0 ? handleMove : undefined}
      moveStores={otherStores}
    />
  );
}
