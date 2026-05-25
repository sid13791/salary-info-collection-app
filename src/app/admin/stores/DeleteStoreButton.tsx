"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface DeleteStoreButtonProps {
  storeId: string;
  storeName: string;
}

export function DeleteStoreButton({ storeId, storeName }: DeleteStoreButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setError(null);

    // Fetch dependency counts for descriptive confirmation
    const depsRes = await fetch(`/api/stores/${storeId}/deps`);
    const deps = await depsRes.json().catch(() => ({}));
    setBusy(false);

    if (!depsRes.ok) {
      setError(deps.error ?? "Failed to check store dependencies");
      return;
    }

    const parts: string[] = [];
    if (deps.packerCount > 0) parts.push(`${deps.packerCount} packer(s)`);
    if (deps.managerCount > 0) parts.push(`${deps.managerCount} manager(s)`);
    const detail = parts.length > 0
      ? ` This will permanently remove ${parts.join(" and ")}.`
      : "";

    if (!confirm(`Delete store "${storeName}"?${detail} This cannot be undone.`)) return;

    setBusy(true);
    const res = await fetch(`/api/stores/${storeId}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Delete failed");
      return;
    }
    router.refresh();
  }

  return (
    <span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-danger hover:text-danger"
        disabled={busy}
        onClick={handleDelete}
      >
        {busy ? "..." : "Delete"}
      </Button>
      {error && <span className="text-xs text-danger ml-1">{error}</span>}
    </span>
  );
}
