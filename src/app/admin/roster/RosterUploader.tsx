"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseRosterBuffer } from "@/lib/excel/parse-roster";
import { Button } from "@/components/ui/Button";

interface DiffPreview {
  matched: number;
  newPackers: Array<{ emp_id: string; name: string; store_code: string }>;
  reactivated: number;
  deactivated: Array<{ emp_id: string; name: string; store_code: string }>;
  storeMigrations: Array<{ emp_id: string; from: string; to: string }>;
  invalidRows: Array<{ rowIndex: number; reason: string }>;
}

export function RosterUploader() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DiffPreview | null>(null);
  const [parsedRows, setParsedRows] = useState<unknown[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      // Send to server for diff preview
      const res = await fetch("/api/roster/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows: parsed.rows }),
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

  async function commit() {
    if (!parsedRows) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/roster/commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rows: parsedRows }),
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

  return (
    <div className="space-y-4">
      <label className="block border-2 border-dashed rounded-md p-8 text-center cursor-pointer hover:bg-muted/40 transition">
        <input
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <span className="text-sm">
          {file ? `Selected: ${file.name}` : "Click to choose an .xlsx file (or drag here)"}
        </span>
      </label>

      {error && <div className="rounded-md border border-danger/30 bg-danger/5 text-danger p-3 text-sm">{error}</div>}

      {preview && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <Stat label="Matched (carry forward)" value={preview.matched} />
            <Stat label="New" value={preview.newPackers.length} />
            <Stat label="Reactivated" value={preview.reactivated} />
            <Stat label="Deactivated" value={preview.deactivated.length} />
          </div>

          {preview.invalidRows.length > 0 && (
            <Section title={`Invalid rows (${preview.invalidRows.length})`} variant="danger">
              <ul className="text-sm space-y-1">
                {preview.invalidRows.slice(0, 20).map((r, i) => (
                  <li key={i}>Row {r.rowIndex + 2}: {r.reason}</li>
                ))}
                {preview.invalidRows.length > 20 && <li>… and {preview.invalidRows.length - 20} more</li>}
              </ul>
            </Section>
          )}

          {preview.storeMigrations.length > 0 && (
            <Section title={`Store migrations detected (${preview.storeMigrations.length})`} variant="warning">
              <ul className="text-sm space-y-1">
                {preview.storeMigrations.map((m, i) => (
                  <li key={i}>{m.emp_id}: {m.from} → {m.to}. Bank details will NOT carry over (new packer row in new store).</li>
                ))}
              </ul>
            </Section>
          )}

          {preview.deactivated.length > 0 && (
            <Section title={`Will be marked inactive (${preview.deactivated.length})`}>
              <ul className="text-sm space-y-1">
                {preview.deactivated.slice(0, 20).map((p, i) => (
                  <li key={i}>{p.emp_id} — {p.name} ({p.store_code})</li>
                ))}
                {preview.deactivated.length > 20 && <li>… and {preview.deactivated.length - 20} more</li>}
              </ul>
            </Section>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={commit} disabled={busy || preview.invalidRows.length > 0}>
              {busy ? "Committing…" : "Confirm and commit"}
            </Button>
            <Button variant="ghost" onClick={() => { setPreview(null); setFile(null); setParsedRows(null); }}>
              Discard
            </Button>
          </div>
          {preview.invalidRows.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Fix invalid rows in your Excel and re-upload before committing.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function Section({ title, children, variant = "default" }: { title: string; children: React.ReactNode; variant?: "default" | "warning" | "danger" }) {
  const cls = {
    default: "border-border",
    warning: "border-warning/30 bg-warning/5",
    danger: "border-danger/30 bg-danger/5",
  }[variant];
  return (
    <div className={`rounded-md border p-3 ${cls}`}>
      <div className="font-medium text-sm mb-2">{title}</div>
      {children}
    </div>
  );
}
