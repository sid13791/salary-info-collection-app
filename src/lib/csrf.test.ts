import { describe, it, expect } from "vitest";
import { requireJsonContentType } from "./csrf";

describe("requireJsonContentType", () => {
  it("returns null for valid application/json content type", () => {
    const req = new Request("http://localhost", {
      headers: { "content-type": "application/json" },
    });
    expect(requireJsonContentType(req)).toBeNull();
  });

  it("returns null for application/json with charset", () => {
    const req = new Request("http://localhost", {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
    expect(requireJsonContentType(req)).toBeNull();
  });

  it("returns 415 response when content-type is missing", () => {
    const req = new Request("http://localhost");
    const res = requireJsonContentType(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(415);
  });

  it("returns 415 response for text/plain", () => {
    const req = new Request("http://localhost", {
      headers: { "content-type": "text/plain" },
    });
    const res = requireJsonContentType(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(415);
  });

  it("returns 415 response for multipart/form-data", () => {
    const req = new Request("http://localhost", {
      headers: { "content-type": "multipart/form-data" },
    });
    const res = requireJsonContentType(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(415);
  });

  it("returns 415 response for application/x-www-form-urlencoded", () => {
    const req = new Request("http://localhost", {
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    const res = requireJsonContentType(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(415);
  });
});
