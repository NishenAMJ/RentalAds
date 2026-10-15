import { defineConfig } from "@playwright/test";

const PORT = 3100;

/**
 * Browser tests run against a local dev server. Supabase and the API are replaced
 * inside each test (see e2e/support/mock-backend.ts), so no real services or accounts are used.
 * Uses the installed Microsoft Edge by default; set PLAYWRIGHT_CHANNEL=chrome (or "" for bundled Chromium) to change.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge",
    trace: "retain-on-failure",
  },
  webServer: {
    // A production build is much faster to run and closer to what users get than the dev server.
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-key",
      NEXT_PUBLIC_API_URL: "http://localhost:3999",
    },
  },
});
