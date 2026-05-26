import { describe, it, expect } from "vitest";
import { deriveStatus } from "./db";

describe("deriveStatus", () => {
  it("returns 'provided' when both bank and ifsc present", () => {
    expect(deriveStatus("123456789", "ICIC0001234")).toBe("provided");
  });

  it("returns 'missing' when bank is null", () => {
    expect(deriveStatus(null, "ICIC0001234")).toBe("missing");
  });

  it("returns 'missing' when ifsc is null", () => {
    expect(deriveStatus("123456789", null)).toBe("missing");
  });

  it("returns 'missing' when both are null", () => {
    expect(deriveStatus(null, null)).toBe("missing");
  });

  it("returns 'missing' when bank is empty string", () => {
    expect(deriveStatus("", "ICIC0001234")).toBe("missing");
  });

  it("returns 'missing' when ifsc is empty string", () => {
    expect(deriveStatus("123456789", "")).toBe("missing");
  });
});
