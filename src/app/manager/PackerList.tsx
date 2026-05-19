"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Packer } from "@/lib/supabase/types";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";

export function ManagerPackerList({ packers, cycleOpen }: { packers: Packer[]; cycleOpen: boolean }) {
  const [filter, setFilter] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return packers.filter((p) => {
      if (onlyMissing && p.bank_details_status !== "missing") return false;
      if (!f) return true;
      return (
        p.emp_id.toLowerCase().includes(f) ||
        p.name.toLowerCase().includes(f) ||
        (p.bank_account_no ?? "").includes(f)
      );
    });
  }, [packers, filter, onlyMissing]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <Input
          placeholder="Search emp ID, name, account…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
          Missing only
        </label>
      </div>

      <ul className="space-y-2">
        {filtered.map((p) => (
          <li key={p.id}>
            <Link
              href={cycleOpen ? `/manager/${p.id}` : "#"}
              className={`block rounded-md border p-3 ${cycleOpen ? "hover:bg-muted/50" : "opacity-70 cursor-not-allowed"}`}
              aria-disabled={!cycleOpen}
              onClick={(e) => { if (!cycleOpen) e.preventDefault(); }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{p.emp_id}</div>
                  {p.bank_account_no && (
                    <div className="text-xs mt-1 truncate">
                      {maskAccount(p.bank_account_no)} · {p.ifsc_code}
                    </div>
                  )}
                </div>
                <div>
                  {p.bank_details_status === "missing"
                    ? <Badge variant="warning">Missing</Badge>
                    : <Badge variant="success">Provided</Badge>}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function maskAccount(acc: string): string {
  if (acc.length <= 4) return acc;
  return "•".repeat(acc.length - 4) + acc.slice(-4);
}
