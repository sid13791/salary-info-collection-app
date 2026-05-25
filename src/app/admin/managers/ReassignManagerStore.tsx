"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Store } from "@/lib/db";
import { Button } from "@/components/ui/Button";

export function ReassignManagerStore({
  managerId,
  currentStoreId,
  stores,
}: {
  managerId: string;
  currentStoreId: string | null;
  stores: Pick<Store, "id" | "name">[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [storeId, setStoreId] = useState(currentStoreId ?? stores[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (storeId === currentStoreId) { setOpen(false); return; }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/managers/${managerId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ store_id: storeId }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to reassign");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-primary underline-offset-2 hover:underline"
      >
        Reassign
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={storeId}
        onChange={(e) => setStoreId(e.target.value)}
        className="h-8 rounded-md border bg-background px-2 text-sm"
      >
        {stores.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
      <button
        type="button"
        onClick={() => { setOpen(false); setError(null); }}
        className="text-xs text-muted-foreground hover:underline"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
