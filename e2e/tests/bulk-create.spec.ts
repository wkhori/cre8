import { test, expect } from "@playwright/test";
import { signIn, goToBoard, TEST_USERS } from "../helpers/auth";
import { injectRects, clearCanvas, getShapeCount } from "../helpers/shapes";
import { measureFps, getMetrics, logResult } from "../helpers/metrics";
import { waitForStores, waitForFpsStable } from "../helpers/wait";

const COUNTS = [100, 250, 500];

for (const count of COUNTS) {
  test(`bulk create ${count} shapes`, async ({ page }) => {
    await signIn(page, TEST_USERS.a.email, TEST_USERS.a.password);
    await goToBoard(page, `perf-create-${count}`);
    await waitForStores(page);

    // Measure creation time
    const creationMs = await injectRects(page, count);

    // Verify count
    const shapeCount = await getShapeCount(page);
    expect(shapeCount).toBe(count);

    // Let rendering settle, measure FPS via rAF
    await page.waitForTimeout(1000);
    const fpsAfter = await measureFps(page, 3000);
    const metrics = await getMetrics(page);

    logResult(`bulk-create-${count}`, {
      count,
      creationMs: Math.round(creationMs),
      objectCount: metrics.objectCount,
      konvaNodeCount: metrics.konvaNodeCount,
      fpsMin: fpsAfter.min,
      fpsMax: fpsAfter.max,
      fpsAvg: fpsAfter.avg,
    });

    test.info().annotations.push({
      type: "perf-result",
      description: JSON.stringify({
        test: `bulk-create-${count}`,
        creationMs: Math.round(creationMs),
        objectCount: metrics.objectCount,
        fpsAfter,
      }),
    });

    // Cleanup
    await clearCanvas(page);
  });
}
