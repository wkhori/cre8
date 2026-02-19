import { defineConfig, devices } from "@playwright/test";

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
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "perf-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  globalSetup: "./global-setup.ts",

  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: true,
    timeout: 30_000,
  },

  reporter: [["list"], ["html", { open: "never" }]],
});
