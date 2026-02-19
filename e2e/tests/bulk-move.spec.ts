import { test } from "@playwright/test";
import { signIn, goToBoard, TEST_USERS } from "../helpers/auth";
import { injectRects, selectAll, moveSelected, clearCanvas } from "../helpers/shapes";
import { measureFps, logResult } from "../helpers/metrics";
import { waitForStores, waitForFpsStable } from "../helpers/wait";

test("bulk move 500 shapes via store", async ({ page }) => {
  await signIn(page, TEST_USERS.a.email, TEST_USERS.a.password);
  await goToBoard(page, "perf-move-500");
  await waitForStores(page);

  // Seed shapes
  await injectRects(page, 500);
  await waitForFpsStable(page);

  // Select all
  await selectAll(page);
  await page.waitForTimeout(500);

  // Measure FPS baseline
  const fpsBefore = await measureFps(page, 2000);

  // Perform 10 move operations
  const moveTimes: number[] = [];
  for (let i = 0; i < 10; i++) {
    const ms = await moveSelected(page, 5, 0);
    moveTimes.push(Math.round(ms));
    await page.waitForTimeout(100);
  }

  // Measure FPS after moves
  const fpsAfter = await measureFps(page, 3000);

  logResult("bulk-move-500", {
    shapeCount: 500,
    movesPerformed: 10,
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

  // Seed shapes
  await injectRects(page, 500);
  await waitForFpsStable(page);

  // Select all via keyboard
  await page.keyboard.press("Meta+a");
  await page.waitForTimeout(500);

  const fpsBefore = await measureFps(page, 2000);

  // Nudge with arrow keys
  const start = Date.now();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(50);
  }
  const totalMs = Date.now() - start;

  const fpsAfter = await measureFps(page, 3000);

  logResult("bulk-move-keys-500", {
    shapeCount: 500,
    nudges: 10,
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
