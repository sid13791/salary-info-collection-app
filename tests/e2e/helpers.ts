import { type Page, expect } from "@playwright/test";

/** Sign in via the login form. */
export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  // Wait for redirect away from /login
  await expect(page).not.toHaveURL(/\/login/);
}

export async function loginAsAdmin(page: Page) {
  await login(page, "admin@test.local", "admin12345");
  await expect(page).toHaveURL(/\/admin/);
}

export async function loginAsManager(page: Page, store: "ncr" | "mum" = "ncr") {
  await login(page, `mgr.${store}@test.local`, "manager12345");
  await expect(page).toHaveURL(/\/manager/);
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);
}
