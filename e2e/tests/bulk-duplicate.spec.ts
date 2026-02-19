import { test, expect } from "@playwright/test";
import { signIn, goToBoard, TEST_USERS } from "../helpers/auth";
import {
  injectRects,
  selectAll,
  duplicateSelected,
  clearCanvas,
  getShapeCount,
} from "../helpers/shapes";
import { measureFps, logResult } from "../helpers/metrics";
import { waitForStores, waitForFpsStable } from "../helpers/wait";

test("duplicate 250 -> 500 shapes", async ({ page }) => {
  await signIn(page, TEST_USERS.a.email, TEST_USERS.a.password);
  await goToBoard(page, "perf-dup-250");
  await waitForStores(page);

  await clearCanvas(page);
  await page.waitForTimeout(1000);

  await injectRects(page, 250);
  await waitForFpsStable(page);
  await selectAll(page);
  await page.waitForTimeout(300);

  const dupMs = await duplicateSelected(page);
  const count = await getShapeCount(page);
  expect(count).toBeGreaterThanOrEqual(500);

  await page.waitForTimeout(500);
  const fpsAfter = await measureFps(page, 2000);

  logResult("duplicate-250-to-500", {
    initialCount: 250,
    finalCount: count,
    duplicationMs: Math.round(dupMs),
    fpsAvg: fpsAfter.avg,
    fpsMin: fpsAfter.min,
  });

  test.info().annotations.push({
    type: "perf-result",
    description: JSON.stringify({
      test: "duplicate-250-to-500",
      dupMs: Math.round(dupMs),
      finalCount: count,
      fpsAfter,
    }),
  });

  await clearCanvas(page);
});

test("duplicate 500 -> 1000 shapes", async ({ page }) => {
  await signIn(page, TEST_USERS.a.email, TEST_USERS.a.password);
  await goToBoard(page, "perf-dup-500");
  await waitForStores(page);

  await clearCanvas(page);
  await page.waitForTimeout(1000);

  await injectRects(page, 500);
  await waitForFpsStable(page);
  await selectAll(page);
  await page.waitForTimeout(300);

  const dupMs = await duplicateSelected(page);
  const count = await getShapeCount(page);
  expect(count).toBeGreaterThanOrEqual(1000);

  await page.waitForTimeout(500);
  const fpsAfter = await measureFps(page, 2000);

  logResult("duplicate-500-to-1000", {
    initialCount: 500,
    finalCount: count,
    duplicationMs: Math.round(dupMs),
    fpsAvg: fpsAfter.avg,
    fpsMin: fpsAfter.min,
  });

  test.info().annotations.push({
    type: "perf-result",
    description: JSON.stringify({
      test: "duplicate-500-to-1000",
      dupMs: Math.round(dupMs),
      finalCount: count,
      fpsAfter,
    }),
  });

  await clearCanvas(page);
});
