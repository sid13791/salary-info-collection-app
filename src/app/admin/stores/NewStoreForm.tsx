"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function NewStoreForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    const res = await fetch("/api/stores", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, name }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to add store");
      return;
    }
    setSuccess(`Added ${body.code}`);
    setCode("");
    setName("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
      <label className="block">
        <span className="text-sm font-medium">Code</span>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
          placeholder="NCR03"
          maxLength={16}
          required
          className="mt-1 font-mono"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Name</span>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Delhi – Saket"
          maxLength={200}
          required
          className="mt-1"
        />
      </label>
      <Button type="submit" disabled={busy}>{busy ? "Adding…" : "Add store"}</Button>
      {error && <p className="text-sm text-danger md:col-span-3">{error}</p>}
      {success && <p className="text-sm text-success md:col-span-3">{success}</p>}
    </form>
  );
}
