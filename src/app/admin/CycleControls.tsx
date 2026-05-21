"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Cycle } from "@/lib/db";
import { Button } from "@/components/ui/Button";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function todayParts() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 }; // 1–12
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function CycleControls({
  cycle,
  pastCycles,
}: {
  cycle: Cycle | null;
  /** All non-open cycles (closed + any past), used to show "will reopen" hints + a quick-pick. */
  pastCycles: Cycle[];
}) {
  const router = useRouter();
  const today = todayParts();
  const [busy, setBusy] = useState(false);
  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month);
  const [error, setError] = useState<string | null>(null);

  // Year dropdown: previous year, current year, next year
  const years = [today.year - 1, today.year, today.year + 1];
  const selectedMonth = `${year}-${pad2(month)}`;
  const existingForSelection = useMemo(
    () => pastCycles.find((c) => c.month === selectedMonth),
    [pastCycles, selectedMonth],
  );

  async function openCycle() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/cycle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "open", month: selectedMonth }),
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

  // ============================================================
  // CYCLE OPEN — show current + "Close" button
  // ============================================================
  if (cycle) {
    return (
      <div className="rounded-md border p-4 bg-success/5 border-success/30 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm text-muted-foreground">Current cycle</div>
          <div className="font-semibold">
            {MONTHS[Number(cycle.month.split("-")[1]) - 1]} {cycle.month.split("-")[0]} — <span className="text-success">OPEN</span>
          </div>
        </div>
        <Button variant="danger" onClick={closeCycle} disabled={busy}>
          {busy ? "Closing…" : "Close cycle"}
        </Button>
        {error && <p className="text-sm text-danger w-full">{error}</p>}
      </div>
    );
  }

  // ============================================================
  // NO OPEN CYCLE — month/year dropdowns + Open button
  // ============================================================
  return (
    <div className="rounded-md border p-4 space-y-3">
      <div className="text-sm text-muted-foreground">No active cycle</div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-sm font-medium block mb-1">Month</span>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="h-10 rounded-md border bg-background px-3 text-sm min-w-[10rem]"
          >
            {MONTHS.map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium block mb-1">Year</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-10 rounded-md border bg-background px-3 text-sm min-w-[6rem]"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>

        <Button onClick={openCycle} disabled={busy}>
          {busy ? "Opening…" : existingForSelection ? "Reopen cycle" : "Open cycle"}
        </Button>
      </div>

      {existingForSelection && (
        <p className="text-xs text-muted-foreground">
          A cycle for <b>{selectedMonth}</b> already exists (status: {existingForSelection.status}).
          Clicking will reopen it — bank details and audit history are preserved.
        </p>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
