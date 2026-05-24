import { test, expect } from "@playwright/test";
import { loginAsManager } from "./helpers";

test.describe("Manager edits packer bank details", () => {
  test("save valid bank details → status flips Missing → Provided", async ({ page }) => {
    await loginAsManager(page, "ncr");

    await page.getByRole("link", { name: /PKR001/ }).click();
    await expect(page).toHaveURL(/\/manager\/[a-f0-9-]+/);

    await page.getByLabel("Bank account number").fill("123456789012");
    await page.getByLabel("Re-enter account number").fill("123456789012");
    await page.getByLabel("IFSC code").fill("ICIC0001234");
    await page.getByLabel("Phone (10 digits)").fill("9876543210");

    await page.getByRole("button", { name: /save/i }).click();

    await expect(page).toHaveURL(/\/manager$/, { timeout: 15000 });
    const row = page.locator("li", { hasText: "PKR001" });
    await expect(row.getByText(/provided/i)).toBeVisible();
    await expect(row.getByText("9012")).toBeVisible();
  });

  test("invalid IFSC blocks save", async ({ page }) => {
    await loginAsManager(page, "ncr");
    await page.getByText("PKR002").click();

    await page.getByLabel("Bank account number").fill("123456789012");
    await page.getByLabel("Re-enter account number").fill("123456789012");
    await page.getByLabel("IFSC code").fill("BADCODE123");
    await page.getByLabel("Phone (10 digits)").fill("9876543210");

    await expect(page.getByRole("button", { name: /save/i })).toBeDisabled();
    await expect(page.getByText(/format: 4 letters \+ 0 \+ 6 alphanumeric/i)).toBeVisible();
  });

  test("mismatched re-entry blocks save", async ({ page }) => {
    await loginAsManager(page, "ncr");
    await page.getByText("PKR003").click();

    await page.getByLabel("Bank account number").fill("123456789012");
    await page.getByLabel("Re-enter account number").fill("123456789999");
    await page.getByLabel("IFSC code").fill("ICIC0001234");
    await page.getByLabel("Phone (10 digits)").fill("9876543210");

    await expect(page.getByRole("button", { name: /save/i })).toBeDisabled();
    await expect(page.getByText(/account numbers don/i)).toBeVisible(); // matches apostrophe variants
  });
});
