"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Store } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function NewManagerForm({ stores }: { stores: Pick<Store, "id" | "code" | "name">[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    const res = await fetch("/api/managers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, store_id: storeId }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to create manager");
      return;
    }
    setSuccess(`Created ${email}. Share the password with the manager.`);
    setEmail("");
    setPassword("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
      <label className="block">
        <span className="text-sm font-medium">Email</span>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Password</span>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="mt-1" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Store</span>
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" required>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
        </select>
      </label>
      <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create manager"}</Button>
      {error && <p className="text-sm text-danger md:col-span-4">{error}</p>}
      {success && <p className="text-sm text-success md:col-span-4">{success}</p>}
    </form>
  );
}
