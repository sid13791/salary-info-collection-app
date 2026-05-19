import { describe, it, expect } from "vitest";
import {
  IFSC_REGEX,
  ACCOUNT_REGEX,
  PHONE_REGEX,
  normalizeEmpId,
  normalizeIfsc,
  normalizeDigits,
  bankDetailsSchema,
} from "./validators";

describe("regex validators", () => {
  it("IFSC: accepts valid codes", () => {
    expect(IFSC_REGEX.test("ICIC0001234")).toBe(true);
    expect(IFSC_REGEX.test("HDFC0ABCDEF")).toBe(true);
    expect(IFSC_REGEX.test("SBIN0000001")).toBe(true);
  });

  it("IFSC: rejects invalid codes", () => {
    expect(IFSC_REGEX.test("icic0001234")).toBe(false); // lowercase
    expect(IFSC_REGEX.test("ICIC1001234")).toBe(false); // 5th char must be 0
    expect(IFSC_REGEX.test("ICIC0001")).toBe(false); // too short
    expect(IFSC_REGEX.test("")).toBe(false);
  });

  it("account: accepts 9–18 digits", () => {
    expect(ACCOUNT_REGEX.test("123456789")).toBe(true);
    expect(ACCOUNT_REGEX.test("123456789012345678")).toBe(true);
  });

  it("account: rejects too short, too long, non-digits", () => {
    expect(ACCOUNT_REGEX.test("12345678")).toBe(false);
    expect(ACCOUNT_REGEX.test("1234567890123456789")).toBe(false);
    expect(ACCOUNT_REGEX.test("12345abc9")).toBe(false);
  });

  it("phone: requires exactly 10 digits", () => {
    expect(PHONE_REGEX.test("9876543210")).toBe(true);
    expect(PHONE_REGEX.test("123456789")).toBe(false);
    expect(PHONE_REGEX.test("98765432101")).toBe(false);
    expect(PHONE_REGEX.test("98765-4321")).toBe(false);
  });
});

describe("normalizers", () => {
  it("emp_id: trims and uppercases", () => {
    expect(normalizeEmpId("  pkr001  ")).toBe("PKR001");
  });

  it("ifsc: trims and uppercases", () => {
    expect(normalizeIfsc("  icic0001234 ")).toBe("ICIC0001234");
  });

  it("digits: strips non-digits", () => {
    expect(normalizeDigits("987-654 3210")).toBe("9876543210");
    expect(normalizeDigits("abc123def456")).toBe("123456");
  });
});

describe("bankDetailsSchema", () => {
  it("accepts complete valid input", () => {
    const r = bankDetailsSchema.safeParse({
      bank_account_no: "123456789012",
      ifsc_code: "ICIC0001234",
      phone: "9876543210",
    });
    expect(r.success).toBe(true);
  });

  it("rejects malformed IFSC", () => {
    const r = bankDetailsSchema.safeParse({
      bank_account_no: "123456789012",
      ifsc_code: "bad",
      phone: "9876543210",
    });
    expect(r.success).toBe(false);
  });
});
