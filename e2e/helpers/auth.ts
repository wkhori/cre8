import { type Page } from "@playwright/test";

export const TEST_USERS = {
  a: { email: "perf-a@test.cre8.app", password: "testpass123!", name: "Perf User A" },
  b: { email: "perf-b@test.cre8.app", password: "testpass123!", name: "Perf User B" },
};

/**
 * Sign in via the email/password form on the landing page.
 * Waits until redirected to /boards.
 */
export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/");
  await page.waitForSelector("text=Get started", { timeout: 15_000 });

  // Reveal email form
  await page.click("text=or continue with email");
  await page.waitForSelector("#auth-email", { timeout: 5_000 });

  // Fill credentials
  await page.fill("#auth-email", email);
  await page.fill("#auth-password", password);

  // Submit
  await page.click('button[type="submit"]');

  // Wait for redirect to boards list
  await page.waitForURL("**/boards**", { timeout: 15_000 });
}

/**
 * Sign up a new account. If account already exists, falls back to sign in.
 */
export async function signUpOrIn(
  page: Page,
  name: string,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/");
  await page.waitForSelector("text=Get started", { timeout: 15_000 });

  // Reveal email form
  await page.click("text=or continue with email");
  await page.waitForSelector("#auth-email", { timeout: 5_000 });

  // Switch to sign-up mode
  await page.click("text=Need an account? Sign up");
  await page.waitForSelector("#auth-name", { timeout: 5_000 });

  // Fill sign-up form
  await page.fill("#auth-name", name);
  await page.fill("#auth-email", email);
  await page.fill("#auth-password", password);
  await page.click('button[type="submit"]');

  // Either redirects to /boards (success) or shows error (account exists)
  try {
    await page.waitForURL("**/boards**", { timeout: 10_000 });
    return;
  } catch {
    // Account might already exist — try sign in
  }

  // Fall back to sign in
  await page.click("text=Have an account? Sign in");
  await page.fill("#auth-email", email);
  await page.fill("#auth-password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/boards**", { timeout: 15_000 });
}

/**
 * Navigate to a board and wait for canvas to be ready.
 */
export async function goToBoard(page: Page, boardId: string): Promise<void> {
  await page.goto(`/board/${boardId}`);
  await page.waitForSelector("canvas", { timeout: 15_000 });
  // Wait for store exposure and FPS counter to stabilize
  await page.waitForTimeout(2000);
}
