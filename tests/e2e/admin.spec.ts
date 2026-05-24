import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("Admin core flows", () => {
  test("admin can navigate to Stores and add a new store", async ({ page }) => {
    await loginAsAdmin(page);
    // Use exact match for the top-nav "Stores" link (avoids matching the KPI label too)
    await page.getByRole("link", { name: "Stores", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/stores$/);

    // Seeded stores appear by name in the table
    await expect(page.getByRole("cell", { name: "Delhi - Connaught Place" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Mumbai - Bandra" })).toBeVisible();

    await page.getByLabel("Store Name").fill("Bengaluru - Indiranagar");
    await page.getByRole("button", { name: /add store/i }).click();

    await expect(page.getByText(/added bengaluru/i)).toBeVisible();
    await expect(page.getByRole("cell", { name: "Bengaluru - Indiranagar" })).toBeVisible();
  });

  test("admin can drill into a store and edit a packer", async ({ page }) => {
    await loginAsAdmin(page);
    // First store link on dashboard goes to the store page
    await page.getByRole("link", { name: "Delhi - Connaught Place" }).first().click();
    await expect(page).toHaveURL(/\/admin\/stores\/[a-f0-9-]+$/);

    await page.getByText("PKR001").click();
    await expect(page).toHaveURL(/\/admin\/stores\/[a-f0-9-]+\/packers\/[a-f0-9-]+/);
    await expect(page.getByText(/ramesh/i)).toBeVisible();
  });

  test("admin can create a new manager login", async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole("link", { name: "Managers", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/managers/, { timeout: 10000 });

    await page.getByLabel("Email").fill("new.mgr@test.local");
    await page.getByLabel("Password").fill("newpassword1");
    await page.getByRole("button", { name: /create manager/i }).click();

    await expect(page.getByText(/created new\.mgr@test\.local/i)).toBeVisible();
    // The email also appears in the success message — scope to the table cell only
    await expect(page.getByRole("cell", { name: "new.mgr@test.local" })).toBeVisible();
  });

  test("rejects duplicate manager email", async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole("link", { name: "Managers", exact: true }).click();

    await page.getByLabel("Email").fill("mgr.ncr@test.local");
    await page.getByLabel("Password").fill("anotherpass1");
    await page.getByRole("button", { name: /create manager/i }).click();

    await expect(page.getByText(/already exists/i)).toBeVisible();
  });
});
