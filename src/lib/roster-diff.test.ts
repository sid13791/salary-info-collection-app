import { describe, it, expect } from "vitest";
import { diffRoster, type ExistingPacker, type UploadedRow } from "./roster-diff";

const knownStores = new Set(["NCR01", "MUM02"]);

function existing(overrides: Partial<ExistingPacker> = {}): ExistingPacker {
  return {
    id: overrides.id ?? "id-" + Math.random().toString(36).slice(2, 8),
    emp_id: overrides.emp_id ?? "PKR001",
    name: overrides.name ?? "Test",
    store_code: overrides.store_code ?? "NCR01",
    store_id: overrides.store_id ?? "store-ncr",
    is_active: overrides.is_active ?? true,
  };
}

function uploaded(overrides: Partial<UploadedRow> = {}): UploadedRow {
  return {
    emp_id: overrides.emp_id ?? "PKR001",
    name: overrides.name ?? "Test",
    store_code: overrides.store_code ?? "NCR01",
  };
}

describe("diffRoster", () => {
  it("matched: existing active packer in upload → matched (carry forward)", () => {
    const e = existing({ emp_id: "PKR001", store_code: "NCR01" });
    const d = diffRoster([e], [uploaded({ emp_id: "PKR001", store_code: "NCR01" })], knownStores);
    expect(d.matched).toHaveLength(1);
    expect(d.newPackers).toHaveLength(0);
    expect(d.deactivated).toHaveLength(0);
  });

  it("new: emp_id not in DB → newPackers", () => {
    const d = diffRoster([], [uploaded({ emp_id: "NEW01", store_code: "NCR01" })], knownStores);
    expect(d.newPackers).toHaveLength(1);
  });

  it("reactivated: existing inactive packer present in upload → reactivated", () => {
    const e = existing({ emp_id: "PKR001", store_code: "NCR01", is_active: false });
    const d = diffRoster([e], [uploaded({ emp_id: "PKR001", store_code: "NCR01" })], knownStores);
    expect(d.reactivated).toHaveLength(1);
    expect(d.matched).toHaveLength(0);
  });

  it("deactivated: existing active packer not in upload → deactivated", () => {
    const e = existing({ emp_id: "PKR001", store_code: "NCR01" });
    const d = diffRoster([e], [], knownStores);
    expect(d.deactivated).toHaveLength(1);
  });

  it("does NOT mark inactive packers absent from upload as deactivated", () => {
    const e = existing({ emp_id: "PKR001", store_code: "NCR01", is_active: false });
    const d = diffRoster([e], [], knownStores);
    expect(d.deactivated).toHaveLength(0);
  });

  it("store migration: same emp_id appears in different store → storeMigrations, NOT deactivation", () => {
    const e = existing({ emp_id: "PKR001", store_code: "NCR01" });
    const d = diffRoster([e], [uploaded({ emp_id: "PKR001", store_code: "MUM02" })], knownStores);
    expect(d.storeMigrations).toHaveLength(1);
    expect(d.storeMigrations[0].existing.store_code).toBe("NCR01");
    expect(d.storeMigrations[0].uploaded.store_code).toBe("MUM02");
    expect(d.deactivated).toHaveLength(0);
    expect(d.newPackers).toHaveLength(0);
  });

  it("normalizes whitespace and case in emp_id and store_code", () => {
    const e = existing({ emp_id: "PKR001", store_code: "NCR01" });
    const d = diffRoster([e], [uploaded({ emp_id: " pkr001 ", store_code: " ncr01 " })], knownStores);
    expect(d.matched).toHaveLength(1);
  });

  it("flags unknown store_code as invalid", () => {
    const d = diffRoster([], [uploaded({ store_code: "XXX99" })], knownStores);
    expect(d.invalidRows).toHaveLength(1);
    expect(d.invalidRows[0].reason).toMatch(/Unknown store_code/);
  });

  it("flags missing emp_id, name as invalid", () => {
    const d = diffRoster([], [
      uploaded({ emp_id: "" }),
      uploaded({ name: "" }),
    ], knownStores);
    expect(d.invalidRows).toHaveLength(2);
  });

  it("flags duplicate (emp_id, store) within upload as invalid", () => {
    const d = diffRoster([], [
      uploaded({ emp_id: "PKR001", store_code: "NCR01" }),
      uploaded({ emp_id: "PKR001", store_code: "NCR01" }),
    ], knownStores);
    expect(d.invalidRows.length).toBeGreaterThanOrEqual(1);
    expect(d.invalidRows.every((r) => r.reason.includes("Duplicate"))).toBe(true);
  });

  it("complex scenario: matched + new + deactivated + migration in one pass", () => {
    const e1 = existing({ id: "1", emp_id: "PKR001", store_code: "NCR01" });
    const e2 = existing({ id: "2", emp_id: "PKR002", store_code: "NCR01" });
    const e3 = existing({ id: "3", emp_id: "PKR003", store_code: "NCR01" }); // will be deactivated

    const d = diffRoster(
      [e1, e2, e3],
      [
        uploaded({ emp_id: "PKR001", store_code: "NCR01" }),       // matched
        uploaded({ emp_id: "PKR002", store_code: "MUM02" }),       // migration
        uploaded({ emp_id: "PKR099", store_code: "NCR01", name: "New" }), // new
      ],
      knownStores,
    );

    expect(d.matched).toHaveLength(1);
    expect(d.newPackers).toHaveLength(1);
    expect(d.storeMigrations).toHaveLength(1);
    expect(d.deactivated).toHaveLength(1);
    expect(d.deactivated[0].emp_id).toBe("PKR003");
  });
});
