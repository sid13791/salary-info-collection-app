"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Packer } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { IFSC_REGEX, ACCOUNT_REGEX, PHONE_REGEX } from "@/lib/validators";

export function EditPackerForm({ packer }: { packer: Packer }) {
  const router = useRouter();
  const [bank, setBank] = useState(packer.bank_account_no ?? "");
  const [bankConfirm, setBankConfirm] = useState(packer.bank_account_no ?? "");
  const [ifsc, setIfsc] = useState(packer.ifsc_code ?? "");
  const [phone, setPhone] = useState(packer.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const issues = {
    bank: bank && !ACCOUNT_REGEX.test(bank) ? "9–18 digits" : null,
    bankConfirm: bank && bankConfirm && bank !== bankConfirm ? "Account numbers don't match" : null,
    ifsc: ifsc && !IFSC_REGEX.test(ifsc) ? "Format: 4 letters + 0 + 6 alphanumeric (e.g. ICIC0001234)" : null,
    phone: phone && !PHONE_REGEX.test(phone) ? "10 digits" : null,
  };
  const valid = ACCOUNT_REGEX.test(bank) && bank === bankConfirm && IFSC_REGEX.test(ifsc) && PHONE_REGEX.test(phone);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/packers/${packer.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bank_account_no: bank, ifsc_code: ifsc.toUpperCase(), phone }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Save failed");
      return;
    }
    router.push("/manager");
    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save(); }}
      className="space-y-4"
    >
      <Field label="Bank account number" hint={issues.bank}>
        <Input
          inputMode="numeric"
          autoComplete="off"
          value={bank}
          onChange={(e) => setBank(e.target.value.replace(/\D/g, ""))}
          aria-invalid={!!issues.bank}
        />
      </Field>

      <Field label="Re-enter account number" hint={issues.bankConfirm}>
        <Input
          inputMode="numeric"
          autoComplete="off"
          value={bankConfirm}
          onChange={(e) => setBankConfirm(e.target.value.replace(/\D/g, ""))}
          aria-invalid={!!issues.bankConfirm}
        />
      </Field>

      <Field label="IFSC code" hint={issues.ifsc}>
        <Input
          autoComplete="off"
          autoCapitalize="characters"
          value={ifsc}
          onChange={(e) => setIfsc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11))}
          aria-invalid={!!issues.ifsc}
        />
      </Field>

      <Field label="Phone (10 digits)" hint={issues.phone}>
        <Input
          inputMode="tel"
          autoComplete="off"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          aria-invalid={!!issues.phone}
        />
      </Field>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-2 sticky bottom-0 bg-background pt-2">
        <Button type="submit" disabled={busy || !valid} className="flex-1">
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint: string | null; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <p className="text-xs text-danger mt-1">{hint}</p>}
    </label>
  );
}
