"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

interface PackerEntry {
  emp_id: string;
  name: string;
  store_name: string;
}

interface MigrationEntry {
  emp_id: string;
  from: string;
  to: string;
}

interface InvalidEntry {
  rowIndex: number;
  reason: string;
}

export interface DiffPreview {
  matched: PackerEntry[];
  newPackers: PackerEntry[];
  reactivated: PackerEntry[];
  deactivated: PackerEntry[];
  storeMigrations: MigrationEntry[];
  invalidRows: InvalidEntry[];
  mismatchedRows?: PackerEntry[];
}

interface RosterSummaryModalProps {
  diff: DiffPreview;
  busy: boolean;
  onCommit: (removedKeys: Set<string>, keepActiveKeys: Set<string>) => void;
  onDiscard: () => void;
}

interface TabDef {
  key: string;
  label: string;
  helper: string;
  variant: "muted" | "success" | "warning" | "danger";
  removable: boolean;
  removeLabel: string;
}

const TABS: TabDef[] = [
  { key: "matched", label: "Matched", helper: "These packers are already active and remain unchanged.", variant: "muted", removable: true, removeLabel: "Exclude (will deactivate)" },
  { key: "new", label: "New", helper: "These packers will be created in the database.", variant: "success", removable: true, removeLabel: "Exclude" },
  { key: "reactivated", label: "Reactivated", helper: "These packers were previously deactivated and will be restored.", variant: "success", removable: true, removeLabel: "Exclude" },
  { key: "deactivated", label: "Deactivated", helper: "These packers are absent from the upload and will be marked inactive.", variant: "warning", removable: true, removeLabel: "Keep active" },
  { key: "migrations", label: "Store Migrations", helper: "These packers appear in a different store — resolve manually before committing.", variant: "danger", removable: false, removeLabel: "" },
  { key: "invalid", label: "Invalid Rows", helper: "These rows have validation errors — fix in Excel and re-upload.", variant: "danger", removable: false, removeLabel: "" },
];

const helperColors: Record<string, string> = {
  muted: "border-border bg-muted/50 text-muted-foreground",
  success: "border-success/30 bg-success/5 text-success",
  warning: "border-warning/30 bg-warning/5 text-warning",
  danger: "border-danger/30 bg-danger/5 text-danger",
};

export function RosterSummaryModal({ diff, busy, onCommit, onDiscard }: RosterSummaryModalProps) {
  const [activeTab, setActiveTab] = useState("matched");
  // Keys removed from matched/new/reactivated — excluded from commit
  const [removedKeys, setRemovedKeys] = useState<Set<string>>(new Set());
  // Keys removed from deactivated — these packers will be kept active
  const [keepActiveKeys, setKeepActiveKeys] = useState<Set<string>>(new Set());

  function packerKey(p: PackerEntry) {
    return `${p.emp_id}::${p.store_name}`;
  }

  function toggleRemove(tab: string, p: PackerEntry) {
    const key = packerKey(p);
    if (tab === "deactivated") {
      setKeepActiveKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
    } else {
      setRemovedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
    }
  }

  function isRemoved(tab: string, p: PackerEntry): boolean {
    const key = packerKey(p);
    return tab === "deactivated" ? keepActiveKeys.has(key) : removedKeys.has(key);
  }

  function getItems(tabKey: string): PackerEntry[] {
    switch (tabKey) {
      case "matched": return diff.matched;
      case "new": return diff.newPackers;
      case "reactivated": return diff.reactivated;
      case "deactivated": return diff.deactivated;
      default: return [];
    }
  }

  function getCount(tabKey: string): number {
    switch (tabKey) {
      case "matched": return diff.matched.length;
      case "new": return diff.newPackers.length;
      case "reactivated": return diff.reactivated.length;
      case "deactivated": return diff.deactivated.length;
      case "migrations": return diff.storeMigrations.length;
      case "invalid": return diff.invalidRows.length;
      default: return 0;
    }
  }

  const hasBlockers = diff.invalidRows.length > 0 || diff.storeMigrations.length > 0;
  const totalRemoved = removedKeys.size + keepActiveKeys.size;
  const currentTabDef = TABS.find((t) => t.key === activeTab)!;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Roster Upload Summary</h2>
        <Button variant="ghost" size="sm" onClick={onDiscard}>✕ Close</Button>
      </div>

      {/* Mismatched rows warning */}
      {diff.mismatchedRows && diff.mismatchedRows.length > 0 && (
        <div className="mx-6 mt-3 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
          {diff.mismatchedRows.length} row(s) for other stores were ignored:{" "}
          {[...new Set(diff.mismatchedRows.map((r) => r.store_name))].join(", ")}
        </div>
      )}

      {/* Tab bar */}
      <div className="border-b px-6 flex gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          const count = getCount(tab.key);
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                activeTab === tab.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
                count === 0 && "opacity-50",
              )}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Helper card */}
        <div className={cn("rounded-md border p-3 text-sm", helperColors[currentTabDef.variant])}>
          {currentTabDef.helper}
        </div>

        {/* Packer list for standard tabs */}
        {["matched", "new", "reactivated", "deactivated"].includes(activeTab) && (
          <PackerTable
            items={getItems(activeTab)}
            tabKey={activeTab}
            removable={currentTabDef.removable}
            removeLabel={currentTabDef.removeLabel}
            isRemoved={(p) => isRemoved(activeTab, p)}
            onToggle={(p) => toggleRemove(activeTab, p)}
          />
        )}

        {/* Store migrations */}
        {activeTab === "migrations" && (
          diff.storeMigrations.length === 0 ? (
            <EmptyState />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Employee Code</th>
                  <th className="py-2 pr-4">From Store</th>
                  <th className="py-2">To Store</th>
                </tr>
              </thead>
              <tbody>
                {diff.storeMigrations.map((m, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono">{m.emp_id}</td>
                    <td className="py-2 pr-4">{m.from}</td>
                    <td className="py-2">{m.to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {/* Invalid rows */}
        {activeTab === "invalid" && (
          diff.invalidRows.length === 0 ? (
            <EmptyState />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Row</th>
                  <th className="py-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {diff.invalidRows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-4">{r.rowIndex + 2}</td>
                    <td className="py-2">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

      {/* Footer */}
      <div className="border-t px-6 py-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {totalRemoved > 0 && <span>{totalRemoved} packer(s) excluded from commit</span>}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onDiscard}>Discard</Button>
          <Button
            onClick={() => onCommit(removedKeys, keepActiveKeys)}
            disabled={busy || hasBlockers}
          >
            {busy ? "Committing…" : "Confirm and commit"}
          </Button>
        </div>
        {hasBlockers && (
          <p className="text-xs text-danger absolute bottom-16 right-6">
            Fix invalid rows and store migrations before committing.
          </p>
        )}
      </div>
    </div>
  );
}

function PackerTable({
  items,
  tabKey,
  removable,
  removeLabel,
  isRemoved,
  onToggle,
}: {
  items: PackerEntry[];
  tabKey: string;
  removable: boolean;
  removeLabel: string;
  isRemoved: (p: PackerEntry) => boolean;
  onToggle: (p: PackerEntry) => void;
}) {
  if (items.length === 0) return <EmptyState />;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-2 pr-4">Employee Code</th>
          <th className="py-2 pr-4">Name</th>
          <th className="py-2 pr-4">Store</th>
          {removable && <th className="py-2 text-right">Action</th>}
        </tr>
      </thead>
      <tbody>
        {items.map((p, i) => {
          const removed = isRemoved(p);
          return (
            <tr key={`${tabKey}-${i}`} className={cn("border-b last:border-0", removed && "opacity-50")}>
              <td className={cn("py-2 pr-4 font-mono", removed && "line-through")}>{p.emp_id}</td>
              <td className={cn("py-2 pr-4", removed && "line-through")}>{p.name}</td>
              <td className={cn("py-2 pr-4", removed && "line-through")}>{p.store_name}</td>
              {removable && (
                <td className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onToggle(p)}
                    className={cn(
                      "text-xs px-2 py-1 rounded transition-colors",
                      removed
                        ? "text-primary hover:bg-primary/10"
                        : "text-danger hover:bg-danger/10",
                    )}
                  >
                    {removed ? "Undo" : removeLabel}
                  </button>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-8 text-sm text-muted-foreground">
      No packers in this category.
    </div>
  );
}
