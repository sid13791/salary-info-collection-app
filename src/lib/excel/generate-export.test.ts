import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { generateBankExport, type ExportRow } from "./generate-export";

const makeRow = (overrides: Partial<ExportRow> = {}): ExportRow => ({
  emp_id: "EMP001",
  name: "John Doe",
  store_name: "Store A",
  current_role_name: "Packer",
  user_status: "ACTIVE",
  bank_account_no: "1234567890",
  ifsc_code: "ICIC0001234",
  phone: "9876543210",
  ...overrides,
});

function readBack(buf: Buffer, month = "2025-01") {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheetName = `Payout ${month}`;
  const ws = wb.Sheets[sheetName];
  return { wb, ws, data: XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) };
}

describe("generateBankExport", () => {
  it("generates valid xlsx buffer", () => {
    const buf = generateBankExport([makeRow()], "2025-01");
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(() => XLSX.read(buf, { type: "buffer" })).not.toThrow();
  });

  it("includes correct column headers", () => {
    const buf = generateBankExport([makeRow()], "2025-01");
    const { data } = readBack(buf);
    expect(data[0]).toEqual([
      "emp_id",
      "name",
      "store_name",
      "current_role_name",
      "user_status",
      "bank_account_no",
      "ifsc_code",
      "phone",
      "amount",
    ]);
  });

  it("includes user_status and current_role_name columns", () => {
    const buf = generateBankExport([makeRow()], "2025-01");
    const { data } = readBack(buf);
    const headers = data[0] as string[];
    expect(headers).toContain("user_status");
    expect(headers).toContain("current_role_name");
  });

  it("maps row data correctly", () => {
    const row = makeRow({
      emp_id: "EMP042",
      name: "Jane Smith",
      store_name: "Store B",
      current_role_name: "Manager",
      user_status: "INACTIVE",
      bank_account_no: "9999999999",
      ifsc_code: "HDFC0005678",
      phone: "8001234567",
    });
    const buf = generateBankExport([row], "2025-01");
    const { data } = readBack(buf);
    const dataRow = data[1];
    expect(dataRow[0]).toBe("EMP042");
    expect(dataRow[1]).toBe("Jane Smith");
    expect(dataRow[2]).toBe("Store B");
    expect(dataRow[3]).toBe("Manager");
    expect(dataRow[4]).toBe("INACTIVE");
    expect(dataRow[5]).toBe("9999999999");
    expect(dataRow[6]).toBe("HDFC0005678");
    expect(dataRow[7]).toBe("8001234567");
  });

  it("handles null bank fields", () => {
    const row = makeRow({
      bank_account_no: null,
      ifsc_code: null,
      phone: null,
    });
    const buf = generateBankExport([row], "2025-01");
    const { data } = readBack(buf);
    const dataRow = data[1];
    // Null fields mapped to empty strings; XLSX may omit trailing empties
    // so we check they are either empty string or undefined
    expect(dataRow[5] ?? "").toBe("");
    expect(dataRow[6] ?? "").toBe("");
    expect(dataRow[7] ?? "").toBe("");
  });

  it("handles empty rows array", () => {
    const buf = generateBankExport([], "2025-01");
    const { data } = readBack(buf);
    // Should have only the header row
    expect(data).toHaveLength(1);
    expect(data[0]).toEqual([
      "emp_id",
      "name",
      "store_name",
      "current_role_name",
      "user_status",
      "bank_account_no",
      "ifsc_code",
      "phone",
      "amount",
    ]);
  });

  it("sets sheet name to Payout {month}", () => {
    const buf = generateBankExport([makeRow()], "2025-01");
    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames).toContain("Payout 2025-01");
  });

  it("defaults user_status to ACTIVE when undefined", () => {
    // Force user_status to be falsy by casting
    const row = makeRow({ user_status: undefined as unknown as string });
    const buf = generateBankExport([row], "2025-01");
    const { data } = readBack(buf);
    const dataRow = data[1];
    expect(dataRow[4]).toBe("ACTIVE");
  });
});
