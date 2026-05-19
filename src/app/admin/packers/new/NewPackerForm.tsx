"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Store } from "@/lib/supabase/types";

export function NewPackerForm({ stores, cycleOpen }: { stores: Pick<Store, "id" | "code" | "name">[]; cycleOpen: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({
    emp_id: "",
    name: "",
    store_id: stores[0]?.id ?? "",
    bank_account_no: "",
    ifsc_code: "",
    phone: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const res = await fetch("/api/packers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        emp_id: form.emp_id,
        name: form.name,
        store_id: form.store_id,
        bank_account_no: form.bank_account_no || null,
        ifsc_code: form.ifsc_code || null,
        phone: form.phone || null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to add packer");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Emp ID">
        <Input value={form.emp_id} onChange={(e) => set("emp_id", e.target.value.toUpperCase())} required />
      </Field>
      <Field label="Name">
        <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
      </Field>
      <Field label="Store">
        <select
          value={form.store_id}
          onChange={(e) => set("store_id", e.target.value)}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          required
        >
          {stores.map((s) => (
            <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
          ))}
        </select>
      </Field>
      <details className="rounded-md border p-3">
        <summary className="text-sm cursor-pointer">Bank details (optional, can be added later by manager)</summary>
        <div className="mt-3 space-y-3">
          <Field label="Bank account no.">
            <Input value={form.bank_account_no} onChange={(e) => set("bank_account_no", e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
          </Field>
          <Field label="IFSC code">
            <Input value={form.ifsc_code} onChange={(e) => set("ifsc_code", e.target.value.toUpperCase())} />
          </Field>
          <Field label="Phone (10 digits)">
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" />
          </Field>
        </div>
      </details>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Add packer"}</Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
