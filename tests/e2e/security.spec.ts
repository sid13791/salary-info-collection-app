import { test, expect } from "@playwright/test";
import { loginAsAdmin, loginAsManager } from "./helpers";

test.describe("Security: manager store isolation", () => {
  test("manager cannot edit a packer from another store via UI", async ({ page }) => {
    // NCR manager can see NCR packers but not Mumbai ones
    await loginAsManager(page, "ncr");

    // Verify Mumbai packers are NOT visible
    await expect(page.getByText("PKR101")).toHaveCount(0);
    await expect(page.getByText("PKR102")).toHaveCount(0);
  });

  test("manager cannot edit another store's packer via direct URL", async ({ page, request }) => {
    // Login as NCR manager
    await loginAsManager(page, "ncr");

    // Get a Mumbai packer ID by logging in as admin first in a separate context
    const adminCtx = await page.context().browser()!.newContext();
    const adminPage = await adminCtx.newPage();
    await loginAsAdmin(adminPage);
    await adminPage.getByRole("link", { name: "Mumbai - Bandra" }).first().click();
    await adminPage.waitForURL(/\/admin\/stores\/[a-f0-9-]+$/);
    await adminPage.getByText("PKR101").click();
    await adminPage.waitForURL(/\/packers\/[a-f0-9-]+/);
    const packerUrl = adminPage.url();
    const packerId = packerUrl.split("/packers/")[1];
    await adminCtx.close();

    // NCR manager tries to navigate to Mumbai packer's edit page
    await page.goto(`/manager/${packerId}`);

    // Should be redirected back to /manager (store isolation)
    await expect(page).toHaveURL(/\/manager$/);
  });

  test("manager cannot PATCH another store's packer via API", async ({ page, request }) => {
    // Login as NCR manager to get session cookie
    await loginAsManager(page, "ncr");
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === "salary_session");

    // Get a Mumbai packer ID via admin
    const adminCtx = await page.context().browser()!.newContext();
    const adminPage = await adminCtx.newPage();
    await loginAsAdmin(adminPage);
    await adminPage.getByRole("link", { name: "Mumbai - Bandra" }).first().click();
    await adminPage.waitForURL(/\/admin\/stores\/[a-f0-9-]+$/);
    await adminPage.getByText("PKR101").click();
    await adminPage.waitForURL(/\/packers\/[a-f0-9-]+/);
    const packerUrl = adminPage.url();
    const packerId = packerUrl.split("/packers/")[1];
    await adminCtx.close();

    // Try to PATCH the Mumbai packer using NCR manager's session
    const res = await request.patch(`/api/packers/${packerId}`, {
      headers: {
        "content-type": "application/json",
        cookie: `salary_session=${sessionCookie!.value}`,
      },
      data: {
        bank_account_no: "123456789012",
        ifsc_code: "ICIC0001234",
        phone: "9876543210",
      },
    });

    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not your store/i);
  });
});

test.describe("Security: manager cycle gating", () => {
  test("manager cannot save bank details when cycle is closed", async ({ page, request }) => {
    // First close the cycle as admin
    await loginAsAdmin(page);
    const adminCookies = await page.context().cookies();
    const adminSession = adminCookies.find((c) => c.name === "salary_session");

    const closeRes = await request.post("/api/cycle", {
      headers: {
        "content-type": "application/json",
        cookie: `salary_session=${adminSession!.value}`,
      },
      data: { action: "close" },
    });
    expect(closeRes.ok()).toBeTruthy();

    // Now login as manager and try to edit a packer
    const mgrCtx = await page.context().browser()!.newContext();
    const mgrPage = await mgrCtx.newPage();
    await loginAsManager(mgrPage, "ncr");

    // Try to navigate to packer edit — should redirect back (no open cycle)
    await mgrPage.getByText("PKR001").click();
    // Page should redirect back to /manager since cycle is closed
    await expect(mgrPage).toHaveURL(/\/manager$/);
    await mgrCtx.close();

    // Re-open the cycle for subsequent tests
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const openRes = await request.post("/api/cycle", {
      headers: {
        "content-type": "application/json",
        cookie: `salary_session=${adminSession!.value}`,
      },
      data: { action: "open", month },
    });
    expect(openRes.ok()).toBeTruthy();
  });
});

test.describe("Security: CSRF on DELETE endpoints", () => {
  test("DELETE /api/packers/:id rejects without JSON content-type", async ({ page, request }) => {
    await loginAsAdmin(page);
    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name === "salary_session");

    // Send DELETE with text/plain content-type (simulating form-based CSRF)
    const res = await request.delete("/api/packers/00000000-0000-0000-0000-000000000000", {
      headers: {
        "content-type": "text/plain",
        cookie: `salary_session=${session!.value}`,
      },
    });

    expect(res.status()).toBe(415);
    const body = await res.json();
    expect(body.error).toMatch(/content-type/i);
  });

  test("DELETE /api/stores/:id rejects without JSON content-type", async ({ page, request }) => {
    await loginAsAdmin(page);
    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name === "salary_session");

    const res = await request.delete("/api/stores/00000000-0000-0000-0000-000000000000", {
      headers: {
        "content-type": "text/plain",
        cookie: `salary_session=${session!.value}`,
      },
    });

    expect(res.status()).toBe(415);
    const body = await res.json();
    expect(body.error).toMatch(/content-type/i);
  });
});
