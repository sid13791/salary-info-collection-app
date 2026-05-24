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
    current_role_name: overrides.current_role_name ?? "",
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

  it("INACTIVE in upload → matched (not deactivated), carries user_status label", () => {
    const e = existing({ emp_id: "EMP0001001", store_name: "NOD-Sector-10 New" });
    const d = diffRoster([e], [uploaded({ emp_id: "EMP0001001", store_name: "NOD-Sector-10 New", packman_status: "INACTIVE" })], knownStores);
    expect(d.matched).toHaveLength(1);
    expect(d.matched[0].uploaded.packman_status).toBe("INACTIVE");
    expect(d.deactivated).toHaveLength(0);
  });

  it("inactive DB packer with INACTIVE status in upload → reactivated", () => {
    const e = existing({ emp_id: "EMP0001001", store_name: "NOD-Sector-10 New", is_active: false });
    const d = diffRoster([e], [uploaded({ emp_id: "EMP0001001", store_name: "NOD-Sector-10 New", packman_status: "INACTIVE" })], knownStores);
    expect(d.reactivated).toHaveLength(1);
    expect(d.matched).toHaveLength(0);
  });

  it("new packer with INACTIVE status → newPackers with INACTIVE label", () => {
    const d = diffRoster([], [uploaded({ emp_id: "EMP9999999", packman_status: "INACTIVE" })], knownStores);
    expect(d.newPackers).toHaveLength(1);
    expect(d.newPackers[0].packman_status).toBe("INACTIVE");
  });

  it("deactivated by absence: active DB packer not in upload → deactivated", () => {
    const e1 = existing({ emp_id: "EMP0001001", store_name: "NOD-Sector-10 New" });
    const e2 = existing({ emp_id: "EMP0001002", store_name: "NOD-Sector-10 New" });
    const d = diffRoster([e1, e2], [uploaded({ emp_id: "EMP0001001", store_name: "NOD-Sector-10 New" })], knownStores);
    expect(d.matched).toHaveLength(1);
    expect(d.deactivated).toHaveLength(1);
    expect(d.deactivated[0].emp_id).toBe("EMP0001002");
  });

  it("inactive DB packer absent from upload → not deactivated (already inactive)", () => {
    const e = existing({ emp_id: "EMP0001001", store_name: "NOD-Sector-10 New", is_active: false });
    const d = diffRoster([e], [], knownStores);
    expect(d.deactivated).toHaveLength(0);
  });

  it("store migration: same emp_id appears in different store → storeMigrations", () => {
    const e = existing({ emp_id: "EMP0001001", store_name: "NOD-Sector-10 New" });
    const d = diffRoster([e], [uploaded({ emp_id: "EMP0001001", store_name: "MUM-Andheri" })], knownStores);
    expect(d.storeMigrations).toHaveLength(1);
    expect(d.storeMigrations[0].existing.store_name).toBe("NOD-Sector-10 New");
    expect(d.storeMigrations[0].uploaded.store_name).toBe("MUM-Andheri");
    expect(d.newPackers).toHaveLength(0);
  });

  it("store migration packer not doubly deactivated", () => {
    const e = existing({ id: "m1", emp_id: "EMP0001001", store_name: "NOD-Sector-10 New" });
    const d = diffRoster([e], [uploaded({ emp_id: "EMP0001001", store_name: "MUM-Andheri" })], knownStores);
    expect(d.storeMigrations).toHaveLength(1);
    expect(d.deactivated).toHaveLength(0);
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

  it("carries current_role_name through the diff", () => {
    const e = existing({ emp_id: "EMP0001001", store_name: "NOD-Sector-10 New" });
    const d = diffRoster([e], [uploaded({ emp_id: "EMP0001001", store_name: "NOD-Sector-10 New", current_role_name: "FR_Associate" })], knownStores);
    expect(d.matched).toHaveLength(1);
    expect(d.matched[0].uploaded.current_role_name).toBe("FR_Associate");
  });

  it("complex scenario: matched + new + deactivated-by-absence + migration in one pass", () => {
    const e1 = existing({ id: "1", emp_id: "EMP0001001", store_name: "NOD-Sector-10 New" });
    const e2 = existing({ id: "2", emp_id: "EMP0001002", store_name: "NOD-Sector-10 New" });
    const e3 = existing({ id: "3", emp_id: "EMP0001003", store_name: "NOD-Sector-10 New" });
    const e4 = existing({ id: "4", emp_id: "EMP0001004", store_name: "NOD-Sector-10 New" });

    const d = diffRoster(
      [e1, e2, e3, e4],
      [
        uploaded({ emp_id: "EMP0001001", store_name: "NOD-Sector-10 New" }),                        // matched
        uploaded({ emp_id: "EMP0001002", store_name: "MUM-Andheri" }),                              // migration
        uploaded({ emp_id: "EMP0099099", store_name: "NOD-Sector-10 New", name: "New" }),           // new
        uploaded({ emp_id: "EMP0001003", store_name: "NOD-Sector-10 New", packman_status: "INACTIVE" }), // matched (INACTIVE label, not deactivated)
      ],
      knownStores,
    );

    expect(d.matched).toHaveLength(2); // EMP0001001 + EMP0001003 (INACTIVE is just a label)
    expect(d.newPackers).toHaveLength(1);
    expect(d.storeMigrations).toHaveLength(1);
    // EMP0001004 is absent from upload → deactivated
    // EMP0001002 is in migration, not double-deactivated
    expect(d.deactivated).toHaveLength(1);
    expect(d.deactivated[0].emp_id).toBe("EMP0001004");
  });
});
