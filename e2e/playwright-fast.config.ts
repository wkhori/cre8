import { defineConfig, devices } from "@playwright/test";

/** Stripped-down config for quick single-test runs (no global setup). */
export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  retries: 0,
  fullyParallel: false,
  workers: 1,

  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    viewport: { width: 1280, height: 720 },
    video: "off",
    screenshot: "off",
    trace: "off",
  },

  projects: [
    {
      name: "perf-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: true,
    timeout: 30_000,
  },

  reporter: [["list"], ["./perf-reporter.ts"]],
});
