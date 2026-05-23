"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface DeleteStoreButtonProps {
  storeId: string;
  storeCode: string;
}

export function DeleteStoreButton({ storeId, storeCode }: DeleteStoreButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm(`Delete store "${storeCode}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
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
