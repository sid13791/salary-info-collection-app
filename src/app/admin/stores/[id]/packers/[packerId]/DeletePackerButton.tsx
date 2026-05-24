"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function DeletePackerButton({ packerId, packerName, backHref }: { packerId: string; packerName: string; backHref: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm(`Permanently delete ${packerName}? This cannot be undone.`)) return;
    setBusy(true);
    const res = await fetch(`/api/packers/${packerId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Delete failed");
      setBusy(false);
      return;
    }
    router.push(backHref);
    router.refresh();
  }

  return (
    <Button variant="danger" size="sm" onClick={handleDelete} disabled={busy}>
      {busy ? "Deleting…" : "Delete packer"}
    </Button>
  );
}
