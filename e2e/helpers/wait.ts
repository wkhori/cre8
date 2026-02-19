import { type Page, expect } from "@playwright/test";

/**
 * Poll until the canvas store's shape count reaches `expected`.
 */
export async function waitForShapeCount(
  page: Page,
  expected: number,
  timeoutMs = 30_000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const count = await page.evaluate(() => {
      return (window as any).__cre8?.canvas?.getState().shapes.length ?? 0;
    });
    if (count >= expected) return;
    await page.waitForTimeout(200);
  }
  const finalCount = await page.evaluate(() => {
    return (window as any).__cre8?.canvas?.getState().shapes.length ?? 0;
  });
  expect(finalCount).toBeGreaterThanOrEqual(expected);
}

/**
 * Poll until FPS stabilizes above `minFps` for `stableDurationMs`.
 */
export async function waitForFpsStable(
  page: Page,
  minFps = 20,
  stableDurationMs = 2000
): Promise<void> {
  const deadline = Date.now() + 15_000;
  let stableSince = Date.now();
  while (Date.now() < deadline) {
    const fps = await page.evaluate(() => {
      return (window as any).__cre8?.debug?.getState().fps ?? 0;
    });
    if (fps < minFps) {
      stableSince = Date.now();
    }
    if (Date.now() - stableSince >= stableDurationMs) return;
    await page.waitForTimeout(200);
  }
}

/**
 * Wait for the __cre8 stores to be available on window.
 */
export async function waitForStores(page: Page, timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ready = await page.evaluate(() => {
      return !!(window as any).__cre8?.canvas && !!(window as any).__cre8?.debug;
    });
    if (ready) return;
    await page.waitForTimeout(200);
  }
  throw new Error("__cre8 stores not found on window after timeout");
}
