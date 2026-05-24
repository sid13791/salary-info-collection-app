import { describe, it, expect } from "vitest";
import { diffRoster, type ExistingPacker, type UploadedRow } from "./roster-diff";

const knownStores = new Set(["NOD-Sector-10 New", "MUM-Andheri"]);

function existing(overrides: Partial<ExistingPacker> = {}): ExistingPacker {
  return {
    id: overrides.id ?? "id-" + Math.random().toString(36).slice(2, 8),
    emp_id: overrides.emp_id ?? "EMP0001001",
    name: overrides.name ?? "Test",
    store_name: overrides.store_name ?? "NOD-Sector-10 New",
    store_id: overrides.store_id ?? "store-nod",
    is_active: overrides.is_active ?? true,
  };
}

function uploaded(overrides: Partial<UploadedRow> = {}): UploadedRow {
  return {
    emp_id: overrides.emp_id ?? "EMP0001001",
    name: overrides.name ?? "Test",
    store_name: overrides.store_name ?? "NOD-Sector-10 New",
    packman_status: overrides.packman_status ?? "ACTIVE",
  };
}

describe("diffRoster", () => {
  it("matched: existing active packer in upload → matched (carry forward)", () => {
    const e = existing({ emp_id: "EMP0001001", store_name: "NOD-Sector-10 New" });
    const d = diffRoster([e], [uploaded({ emp_id: "EMP0001001", store_name: "NOD-Sector-10 New" })], knownStores);
    expect(d.matched).toHaveLength(1);
    expect(d.newPackers).toHaveLength(0);
    expect(d.deactivated).toHaveLength(0);
  });

  it("new: emp_id not in DB → newPackers", () => {
    const d = diffRoster([], [uploaded({ emp_id: "EMP9999999", store_name: "NOD-Sector-10 New" })], knownStores);
    expect(d.newPackers).toHaveLength(1);
  });

  it("reactivated: existing inactive packer with ACTIVE status → reactivated", () => {
    const e = existing({ emp_id: "EMP0001001", store_name: "NOD-Sector-10 New", is_active: false });
    const d = diffRoster([e], [uploaded({ emp_id: "EMP0001001", store_name: "NOD-Sector-10 New", packman_status: "ACTIVE" })], knownStores);
    expect(d.reactivated).toHaveLength(1);
    expect(d.matched).toHaveLength(0);
  });

  it("deactivated via packman_status: INACTIVE in upload → deactivated", () => {
    const e = existing({ emp_id: "EMP0001001", store_name: "NOD-Sector-10 New" });
    const d = diffRoster([e], [uploaded({ emp_id: "EMP0001001", store_name: "NOD-Sector-10 New", packman_status: "INACTIVE" })], knownStores);
    expect(d.deactivated).toHaveLength(1);
  });

  it("already inactive packer with INACTIVE status → matched (no-op)", () => {
    const e = existing({ emp_id: "EMP0001001", store_name: "NOD-Sector-10 New", is_active: false });
    const d = diffRoster([e], [uploaded({ emp_id: "EMP0001001", store_name: "NOD-Sector-10 New", packman_status: "INACTIVE" })], knownStores);
    expect(d.matched).toHaveLength(1);
    expect(d.deactivated).toHaveLength(0);
  });

  it("new packer with INACTIVE status → inserted as inactive", () => {
    const d = diffRoster([], [uploaded({ emp_id: "EMP9999999", packman_status: "INACTIVE" })], knownStores);
    expect(d.newPackers).toHaveLength(1);
    expect(d.newPackers[0].packman_status).toBe("INACTIVE");
  });

  it("store migration: same emp_id appears in different store → storeMigrations", () => {
    const e = existing({ emp_id: "EMP0001001", store_name: "NOD-Sector-10 New" });
    const d = diffRoster([e], [uploaded({ emp_id: "EMP0001001", store_name: "MUM-Andheri" })], knownStores);
    expect(d.storeMigrations).toHaveLength(1);
    expect(d.storeMigrations[0].existing.store_name).toBe("NOD-Sector-10 New");
    expect(d.storeMigrations[0].uploaded.store_name).toBe("MUM-Andheri");
    expect(d.deactivated).toHaveLength(0);
    expect(d.newPackers).toHaveLength(0);
  });

  it("normalizes whitespace and case in emp_id", () => {
    const e = existing({ emp_id: "EMP0001001", store_name: "NOD-Sector-10 New" });
    const d = diffRoster([e], [uploaded({ emp_id: " emp0001001 ", store_name: "NOD-Sector-10 New" })], knownStores);
    expect(d.matched).toHaveLength(1);
  });

  it("flags unknown store_name as invalid", () => {
    const d = diffRoster([], [uploaded({ store_name: "UNKNOWN-Store" })], knownStores);
    expect(d.invalidRows).toHaveLength(1);
    expect(d.invalidRows[0].reason).toMatch(/Unknown store_name/);
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
      uploaded({ emp_id: "EMP0001001", store_name: "NOD-Sector-10 New" }),
      uploaded({ emp_id: "EMP0001001", store_name: "NOD-Sector-10 New" }),
    ], knownStores);
    expect(d.invalidRows.length).toBeGreaterThanOrEqual(1);
    expect(d.invalidRows.every((r) => r.reason.includes("Duplicate"))).toBe(true);
  });

  it("complex scenario: matched + new + deactivated + migration in one pass", () => {
    const e1 = existing({ id: "1", emp_id: "EMP0001001", store_name: "NOD-Sector-10 New" });
    const e2 = existing({ id: "2", emp_id: "EMP0001002", store_name: "NOD-Sector-10 New" });
    const e3 = existing({ id: "3", emp_id: "EMP0001003", store_name: "NOD-Sector-10 New" });

    const d = diffRoster(
      [e1, e2, e3],
      [
        uploaded({ emp_id: "EMP0001001", store_name: "NOD-Sector-10 New" }),       // matched
        uploaded({ emp_id: "EMP0001002", store_name: "MUM-Andheri" }),             // migration
        uploaded({ emp_id: "EMP0099099", store_name: "NOD-Sector-10 New", name: "New" }), // new
        uploaded({ emp_id: "EMP0001003", store_name: "NOD-Sector-10 New", packman_status: "INACTIVE" }), // deactivated via status
      ],
      knownStores,
    );

    expect(d.matched).toHaveLength(1);
    expect(d.newPackers).toHaveLength(1);
    expect(d.storeMigrations).toHaveLength(1);
    expect(d.deactivated).toHaveLength(1);
    expect(d.deactivated[0].emp_id).toBe("EMP0001003");
  });
});
