import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config.
 *
 * Tests run against a Next.js dev server on port 3100 connected to the same
 * Supabase instance as local dev (seeded fresh by global-setup.mjs before each
 * suite run). The dev server on port 3000 is untouched — safe to run while
 * you're using the app.
 */

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // serial — shared DB state between tests
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: process.env.CI ? "github" : "list",

  // Seeds the test DB once before the suite starts.
  globalSetup: "./tests/e2e/global-setup.mjs",

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Boot a separate Next.js dev server for tests on port 3100.
  webServer: {
    command: `npm run dev`,
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      PORT: String(PORT),
    },
  },
});
