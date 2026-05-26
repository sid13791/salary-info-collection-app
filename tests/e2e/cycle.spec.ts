import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

/**
 * Helper to get admin session cookie for API calls.
 */
async function getAdminSession(page: import("@playwright/test").Page) {
  await loginAsAdmin(page);
  const cookies = await page.context().cookies();
  return cookies.find((c) => c.name === "salary_session")!;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

test.describe("Cycle management", () => {
  test("cannot open a second cycle while one is already open", async ({ page, request }) => {
    const session = await getAdminSession(page);
    const headers = {
      "content-type": "application/json",
      cookie: `salary_session=${session.value}`,
    };

    // A cycle is already open from global-setup — try to open another
    const res = await request.post("/api/cycle", {
      headers,
      data: { action: "open", month: nextMonth() },
    });

    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already open/i);
  });

  test("close cycle snapshots active packers", async ({ page, request }) => {
    const session = await getAdminSession(page);
    const headers = {
      "content-type": "application/json",
      cookie: `salary_session=${session.value}`,
    };

    // Close the current cycle
    const closeRes = await request.post("/api/cycle", {
      headers,
      data: { action: "close" },
    });
    expect(closeRes.ok()).toBeTruthy();
    const closeBody = await closeRes.json();
    expect(closeBody.ok).toBe(true);
    expect(closeBody.snapshotted).toBeGreaterThanOrEqual(5); // at least 5 seeded packers

    // Re-open for subsequent tests
    const openRes = await request.post("/api/cycle", {
      headers,
      data: { action: "open", month: currentMonth() },
    });
    expect(openRes.ok()).toBeTruthy();
    const openBody = await openRes.json();
    expect(openBody.action).toBe("reopened");
  });

  test("cannot close when no cycle is open", async ({ page, request }) => {
    const session = await getAdminSession(page);
    const headers = {
      "content-type": "application/json",
      cookie: `salary_session=${session.value}`,
    };

    // Close the open cycle first
    await request.post("/api/cycle", {
      headers,
      data: { action: "close" },
    });

    // Try to close again — should fail
    const res = await request.post("/api/cycle", {
      headers,
      data: { action: "close" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no open cycle/i);

    // Re-open for subsequent tests
    await request.post("/api/cycle", {
      headers,
      data: { action: "open", month: currentMonth() },
    });
  });

  test("rejects invalid month format", async ({ page, request }) => {
    const session = await getAdminSession(page);

    // Close existing cycle first
    await request.post("/api/cycle", {
      headers: {
        "content-type": "application/json",
        cookie: `salary_session=${session.value}`,
      },
      data: { action: "close" },
    });

    const res = await request.post("/api/cycle", {
      headers: {
        "content-type": "application/json",
        cookie: `salary_session=${session.value}`,
      },
      data: { action: "open", month: "2025-13" }, // invalid month
    });

    expect(res.status()).toBe(400);

    // Re-open for subsequent tests
    await request.post("/api/cycle", {
      headers: {
        "content-type": "application/json",
        cookie: `salary_session=${session.value}`,
      },
      data: { action: "open", month: currentMonth() },
    });
  });
});

test.describe("Duplicate prevention", () => {
  test("rejects duplicate store name", async ({ page, request }) => {
    const session = await getAdminSession(page);

    const res = await request.post("/api/stores", {
      headers: {
        "content-type": "application/json",
        cookie: `salary_session=${session.value}`,
      },
      data: { name: "Delhi - Connaught Place" }, // already seeded
    });

    // Should fail with unique constraint
    expect(res.ok()).toBeFalsy();
  });
});
