"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Cycle } from "@/lib/supabase/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function CycleControls({ cycle }: { cycle: Cycle | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [month, setMonth] = useState(thisMonth());
  const [error, setError] = useState<string | null>(null);

  async function openCycle() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/cycle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "open", month }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Failed to open cycle");
      return;
    }
    router.refresh();
  }

  async function closeCycle() {
    if (!confirm(`Close cycle ${cycle?.month}? Bank details will be snapshotted and edits locked.`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/cycle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "close" }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Failed to close cycle");
      return;
    }
    router.refresh();
  }

  if (cycle) {
    return (
      <div className="rounded-md border p-4 bg-success/5 border-success/30 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm text-muted-foreground">Current cycle</div>
          <div className="font-semibold">{cycle.month} — OPEN</div>
        </div>
        <Button variant="danger" onClick={closeCycle} disabled={busy}>
          {busy ? "Closing…" : "Close cycle"}
        </Button>
        {error && <p className="text-sm text-danger w-full">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-md border p-4 flex flex-wrap items-end gap-3">
      <div>
        <div className="text-sm text-muted-foreground">No active cycle</div>
        <label className="text-sm font-medium mt-2 block" htmlFor="month">Open cycle for month</label>
        <Input
          id="month"
          type="text"
          placeholder="YYYY-MM"
          pattern="\d{4}-(0[1-9]|1[0-2])"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="mt-1 w-36"
        />
      </div>
      <Button onClick={openCycle} disabled={busy}>
        {busy ? "Opening…" : "Open cycle"}
      </Button>
      {error && <p className="text-sm text-danger w-full">{error}</p>}
    </div>
  );
}
