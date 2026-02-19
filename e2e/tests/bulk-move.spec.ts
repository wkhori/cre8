import { test } from "@playwright/test";
import { signIn, goToBoard, TEST_USERS } from "../helpers/auth";
import { injectRects, selectAll, moveSelected, clearCanvas } from "../helpers/shapes";
import { measureFps, logResult } from "../helpers/metrics";
import { waitForStores, waitForFpsStable } from "../helpers/wait";

test("bulk move 500 shapes via store", async ({ page }) => {
  await signIn(page, TEST_USERS.a.email, TEST_USERS.a.password);
  await goToBoard(page, "perf-move-500");
  await waitForStores(page);

  await clearCanvas(page);
  await page.waitForTimeout(1000);

  // Seed shapes
  await injectRects(page, 500);
  await waitForFpsStable(page, 10, 1000);

  // Select all
  await selectAll(page);
  await page.waitForTimeout(500);

  // Measure FPS baseline
  const fpsBefore = await measureFps(page, 2000);

  // Perform 5 move operations (reduced from 10 to avoid timeout)
  const moveTimes: number[] = [];
  for (let i = 0; i < 5; i++) {
    const ms = await moveSelected(page, 5, 0);
    moveTimes.push(Math.round(ms));
    await page.waitForTimeout(200);
  }

  // Measure FPS after moves
  const fpsAfter = await measureFps(page, 2000);

  logResult("bulk-move-500", {
    shapeCount: 500,
    movesPerformed: 5,
    moveTimesMs: moveTimes,
    avgMoveMs: Math.round(moveTimes.reduce((a, b) => a + b, 0) / moveTimes.length),
    fpsBeforeAvg: fpsBefore.avg,
    fpsAfterAvg: fpsAfter.avg,
    fpsAfterMin: fpsAfter.min,
  });

  test.info().annotations.push({
    type: "perf-result",
    description: JSON.stringify({
      test: "bulk-move-500",
      moveTimes,
      fpsBefore,
      fpsAfter,
    }),
  });

  await clearCanvas(page);
});

test("bulk move 500 shapes via arrow keys", async ({ page }) => {
  await signIn(page, TEST_USERS.a.email, TEST_USERS.a.password);
  await goToBoard(page, "perf-move-keys-500");
  await waitForStores(page);

  await clearCanvas(page);
  await page.waitForTimeout(1000);

  // Seed shapes
  await injectRects(page, 500);
  await waitForFpsStable(page, 10, 1000);

  // Select all via keyboard
  await page.keyboard.press("Meta+a");
  await page.waitForTimeout(500);

  const fpsBefore = await measureFps(page, 2000);

  // Nudge with arrow keys (5 nudges)
  const start = Date.now();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(200);
  }
  const totalMs = Date.now() - start;

  const fpsAfter = await measureFps(page, 2000);

  logResult("bulk-move-keys-500", {
    shapeCount: 500,
    nudges: 5,
    totalMs,
    fpsBeforeAvg: fpsBefore.avg,
    fpsAfterAvg: fpsAfter.avg,
    fpsAfterMin: fpsAfter.min,
  });

  test.info().annotations.push({
    type: "perf-result",
    description: JSON.stringify({
      test: "bulk-move-keys-500",
      totalMs,
      fpsBefore,
      fpsAfter,
    }),
  });

  await clearCanvas(page);
});
