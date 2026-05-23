import { test, expect } from "@playwright/test";
import { login, loginAsAdmin, loginAsManager, signOut } from "./helpers";

test.describe("Auth + role routing", () => {
  test("rejects invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("admin@test.local");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("admin lands on /admin and sees dashboard", async ({ page }) => {
    await loginAsAdmin(page);
    // Header title
    await expect(page.getByText("Salary Info Collection")).toBeVisible();
    // KPI stat labels
    await expect(page.getByText("Active packers", { exact: true })).toBeVisible();
    await expect(page.getByText("Bank details missing", { exact: true })).toBeVisible();
  });

  test("manager lands on /manager and only sees their store", async ({ page }) => {
    await loginAsManager(page, "ncr");
    await expect(page.getByText("PKR001")).toBeVisible();
    await expect(page.getByText("PKR002")).toBeVisible();
    await expect(page.getByText("PKR003")).toBeVisible();
    await expect(page.getByText("PKR101")).toHaveCount(0);
    await expect(page.getByText("PKR102")).toHaveCount(0);
  });

  test("manager cannot reach /admin", async ({ page }) => {
    await loginAsManager(page, "ncr");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/manager/);
  });

  test("sign-out clears session", async ({ page }) => {
    await loginAsAdmin(page);
    await signOut(page);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });
});
