"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface InlinePackerFormProps {
  stores: Array<{ id: string; name: string }>;
  cycleOpen: boolean;
}

export function InlinePackerForm({ stores, cycleOpen }: InlinePackerFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    emp_id: "",
    name: "",
    store_id: stores[0]?.id ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cycleOpen) {
      if (!confirm("No cycle is open. Add anyway?")) return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    const res = await fetch("/api/packers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        emp_id: form.emp_id,
        name: form.name,
        store_id: form.store_id,
        bank_account_no: null,
        ifsc_code: null,
        phone: null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to add packer");
      return;
    }
    setSuccess(`Added ${form.name} (${form.emp_id})`);
    setForm({ emp_id: "", name: "", store_id: stores[0]?.id ?? "" });
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-sm font-medium">Emp ID</span>
          <Input
            value={form.emp_id}
            onChange={(e) => set("emp_id", e.target.value.toUpperCase())}
            placeholder="PKR001"
            required
            className="mt-1"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Name</span>
          <Input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Ramesh Kumar"
            required
            className="mt-1"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Store</span>
          <select
            value={form.store_id}
            onChange={(e) => set("store_id", e.target.value)}
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            required
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}
      <Button type="submit" disabled={busy} size="sm">
        {busy ? "Adding…" : "Add packer"}
      </Button>
    </form>
  );
}
