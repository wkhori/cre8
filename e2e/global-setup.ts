import { chromium } from "@playwright/test";
import { TEST_USERS } from "./helpers/auth";

const BASE_URL = "http://localhost:3000";

/**
 * Global setup: ensure test accounts exist in Firebase Auth.
 * Runs once before all tests. Uses absolute URLs since global setup
 * doesn't have access to Playwright config's baseURL.
 */
async function globalSetup() {
  const browser = await chromium.launch();

  for (const user of Object.values(TEST_USERS)) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(BASE_URL);
      await page.waitForSelector("text=Get started", { timeout: 15_000 });

      // Reveal email form
      await page.click("text=or continue with email");
      await page.waitForSelector("#auth-email", { timeout: 5_000 });

      // Try sign-up first
      await page.click("text=Need an account? Sign up");
      await page.waitForSelector("#auth-name", { timeout: 5_000 });

      await page.fill("#auth-name", user.name);
      await page.fill("#auth-email", user.email);
      await page.fill("#auth-password", user.password);
      await page.click('button[type="submit"]');

      // Wait for redirect (success) or error (account already exists)
      try {
        await page.waitForURL("**/boards**", { timeout: 10_000 });
        console.log(`[global-setup] Created account: ${user.email}`);
        await context.close();
        continue;
      } catch {
        // Account might already exist
      }

      // Check if there's an error message about existing account
      const errorVisible = await page
        .locator("text=An account with this email already exists")
        .isVisible();
      if (errorVisible) {
        // Switch to sign-in
        await page.click("text=Have an account? Sign in");
        await page.fill("#auth-email", user.email);
        await page.fill("#auth-password", user.password);
        await page.click('button[type="submit"]');
        await page.waitForURL("**/boards**", { timeout: 15_000 });
        console.log(`[global-setup] Account already exists, signed in: ${user.email}`);
      } else {
        console.log(`[global-setup] Sign-up may have succeeded for: ${user.email}`);
      }
    } catch (err) {
      console.warn(`[global-setup] Could not set up ${user.email}:`, err);
    }
    await context.close();
  }

  await browser.close();
}

export default globalSetup;
