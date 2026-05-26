"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseRosterBuffer } from "@/lib/excel/parse-roster";
import { Button } from "@/components/ui/Button";
import { RosterSummaryModal, type DiffPreview } from "@/components/RosterSummaryModal";
import { InlinePackerForm } from "./InlinePackerForm";

interface RosterUploaderProps {
  stores: Array<{ id: string; name: string }>;
  cycleOpen: boolean;
}

export function RosterUploader({ stores, cycleOpen }: RosterUploaderProps) {
  const router = useRouter();
  const [selectedStore, setSelectedStore] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DiffPreview | null>(null);
  const [parsedRows, setParsedRows] = useState<unknown[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);

  async function handleFile(f: File) {
    setError(null);
    setPreview(null);
    setFile(f);
    setBusy(true);
    try {
      const buf = await f.arrayBuffer();
      const parsed = parseRosterBuffer(buf);
      if (parsed.errors.length) {
        setError(parsed.errors.join("; "));
        setBusy(false);
        return;
      }
      const res = await fetch("/api/roster/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows: parsed.rows, targetStore: selectedStore }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Preview failed");
        setBusy(false);
        return;
      }
      setPreview(body.diff);
      setParsedRows(parsed.rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read file");
    } finally {
      setBusy(false);
    }
  }

  async function handleCommit(removedKeys: Set<string>, keepActiveKeys: Set<string>) {
    if (!parsedRows) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/roster/commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        rows: parsedRows,
        removedKeys: [...removedKeys],
        keepActive: [...keepActiveKeys],
        targetStore: selectedStore,
      }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Commit failed");
      return;
    }
    alert(`Committed: ${body.applied.created} new, ${body.applied.reactivated} reactivated, ${body.applied.deactivated} deactivated`);
    router.push("/admin");
  }

  function handleDiscard() {
    setPreview(null);
    setFile(null);
    setParsedRows(null);
  }

  return (
    <div className="space-y-4">
      {/* Store selector */}
      <div>
        <label htmlFor="target-store" className="block text-sm font-medium mb-1">
          Target store
        </label>
        <select
          id="target-store"
          value={selectedStore}
          onChange={(e) => {
            setSelectedStore(e.target.value);
            setPreview(null);
            setFile(null);
            setParsedRows(null);
            setError(null);
          }}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Select a store…</option>
          {stores.map((s) => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>
      </div>

      <label className={`block border-2 border-dashed rounded-md p-8 text-center transition ${selectedStore ? "cursor-pointer hover:bg-muted/40" : "cursor-not-allowed opacity-50"}`}>
        <input
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          disabled={!selectedStore}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <span className="text-sm">
          {!selectedStore
            ? "Select a target store first"
            : file
              ? `Selected: ${file.name}`
              : "Click to choose an .xlsx file (or drag here)"}
        </span>
      </label>

      <button
        type="button"
        onClick={() => setShowManualForm((v) => !v)}
        className="text-sm text-muted-foreground underline hover:text-foreground transition"
      >
        {showManualForm ? "Hide manual form" : "Need to add just one packer? Add manually"}
      </button>

      {showManualForm && (
        <div className="rounded-md border p-4">
          <div className="text-sm font-medium mb-3">Add a single packer</div>
          <InlinePackerForm stores={stores} cycleOpen={cycleOpen} />
        </div>
      )}

      {error && <div className="rounded-md border border-danger/30 bg-danger/5 text-danger p-3 text-sm">{error}</div>}

      {preview && (
        <RosterSummaryModal
          diff={preview}
          busy={busy}
          onCommit={handleCommit}
          onDiscard={handleDiscard}
        />
      )}
    </div>
  );
}
