import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

/**
 * Playwright E2E config.
 *
 * Isolation: tests run against a SEPARATE SQLite file (./data/test.db) on port
 * 3100. The dev server you use day-to-day on port 3000 / ./data/app.db is never
 * touched by tests. Safe to run while you're using the app.
 */

const TEST_DB_PATH = path.join(process.cwd(), "data", "test.db");
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // sqlite + a single seed = simpler if serial
  workers: 1,
  retries: 0,
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

  // Boot the Next.js dev server pointed at the test DB.
  webServer: {
    command: `npm run dev`,
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      SALARY_DB_PATH: TEST_DB_PATH,
      PORT: String(PORT),
    },
  },
});
