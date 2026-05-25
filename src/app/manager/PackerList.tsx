"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Packer, Store } from "@/lib/db";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";

export function ManagerPackerList({
  packers,
  cycleOpen,
  editHrefBase = "/manager",
  lockedWhenClosed = true,
  onDelete,
  onMove,
  moveStores = [],
}: {
  packers: Packer[];
  cycleOpen: boolean;
  /** Edit links go to `${editHrefBase}/${packer.id}`. Default `/manager`. */
  editHrefBase?: string;
  /** When false, rows stay clickable even if the cycle is closed (admin override). */
  lockedWhenClosed?: boolean;
  /** If provided, shows a delete button per packer (admin only). */
  onDelete?: (packerId: string, packerName: string) => void;
  /** If provided, shows a move-to-store control per packer (admin only). */
  onMove?: (packerId: string, packerName: string, targetStoreId: string) => void;
  moveStores?: Pick<Store, "id" | "name">[];
}) {
  const canClick = cycleOpen || !lockedWhenClosed;
  const [filter, setFilter] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState(moveStores[0]?.id ?? "");

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
              href={canClick ? `${editHrefBase}/${p.id}` : "#"}
              className={`block rounded-md border p-3 ${canClick ? "hover:bg-muted/50" : "opacity-70 cursor-not-allowed"}`}
              aria-disabled={!canClick}
              onClick={(e) => { if (!canClick) e.preventDefault(); }}
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
                <div className="flex items-center gap-2">
                  {p.bank_details_status === "missing"
                    ? <Badge variant="warning">Missing</Badge>
                    : <Badge variant="success">Provided</Badge>}
                  {onMove && moveStores.length > 0 && (
                    movingId === p.id ? (
                      <span className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                        <select
                          value={moveTarget}
                          onChange={(e) => setMoveTarget(e.target.value)}
                          className="h-7 rounded border bg-background px-1 text-xs"
                        >
                          {moveStores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onMove(p.id, p.name, moveTarget); setMovingId(null); }}
                          className="text-xs text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors"
                        >
                          Move
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setMovingId(null); }}
                          className="text-xs text-muted-foreground hover:underline"
                        >
                          ✕
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMoveTarget(moveStores[0]?.id ?? ""); setMovingId(p.id); }}
                        className="text-xs text-muted-foreground hover:bg-muted px-2 py-1 rounded transition-colors"
                      >
                        Move
                      </button>
                    )
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(p.id, p.name); }}
                      className="text-xs text-danger hover:bg-danger/10 px-2 py-1 rounded transition-colors"
                    >
                      Delete
                    </button>
                  )}
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
