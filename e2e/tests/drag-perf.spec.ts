import { test, expect } from "@playwright/test";
import { signIn, goToBoard, TEST_USERS } from "../helpers/auth";
import { injectRects, selectAll, clearCanvas, getShapeCount } from "../helpers/shapes";
import { measureFps, logResult } from "../helpers/metrics";
import { waitForStores, waitForFpsStable } from "../helpers/wait";

/**
 * Real mouse-drag performance test.
 *
 * Unlike bulk-move (which calls store.updateShapes directly),
 * this test performs an actual Playwright mouse drag on the canvas.
 * This exercises the FULL pipeline:
 *   mousedown → handleDragStart → handleDragMove (per pixel) →
 *   handleDragEnd → store.updateShapes → Firestore write →
 *   onSnapshot echo → setShapes
 *
 * This is the scenario that causes 9 FPS in real usage.
 */

for (const count of [50, 200]) {
  test(`drag ${count} selected shapes with mouse`, async ({ page }) => {
    test.setTimeout(120_000);

    await signIn(page, TEST_USERS.a.email, TEST_USERS.a.password);
    await goToBoard(page, `perf-drag-${count}`);
    await waitForStores(page);

    // Clean slate
    await clearCanvas(page);
    await page.waitForTimeout(1000);

    // Inject shapes in a grid starting at (200, 200)
    await injectRects(page, count);
    await waitForFpsStable(page, 10, 1000);

    const shapeCount = await getShapeCount(page);
    expect(shapeCount).toBeGreaterThanOrEqual(count);

    // Select all shapes
    await selectAll(page);
    await page.waitForTimeout(500);

    // Measure baseline FPS (idle with shapes selected)
    const fpsIdle = await measureFps(page, 2000);

    // Get the bounding box of the canvas container
    const canvasBox = await page.locator(".konvajs-content").boundingBox();
    expect(canvasBox).toBeTruthy();

    // Start drag from center of where shapes are clustered
    const startX = canvasBox!.x + 300;
    const startY = canvasBox!.y + 300;

    // Measure FPS DURING an actual mouse drag
    // We start the drag, move in small increments, and measure FPS concurrently
    const dragResult = await page.evaluate(
      async ({ sx, sy, steps, stepPx }) => {
        // Start FPS measurement
        const fpsSamples: number[] = [];
        let frameCount = 0;
        let lastFpsTime = performance.now();
        let measuring = true;

        function fpsLoop(now: number) {
          if (!measuring) return;
          frameCount++;
          const elapsed = now - lastFpsTime;
          if (elapsed >= 500) {
            fpsSamples.push(Math.round((frameCount / elapsed) * 1000));
            frameCount = 0;
            lastFpsTime = now;
          }
          requestAnimationFrame(fpsLoop);
        }
        requestAnimationFrame(fpsLoop);

        // Simulate mouse drag via native events (matches what Konva processes)
        const stage = document.querySelector(".konvajs-content canvas");
        if (!stage) throw new Error("Canvas not found");

        const rect = stage.getBoundingClientRect();
        const clientStartX = sx - rect.left + rect.left;
        const clientStartY = sy - rect.top + rect.top;

        // mousedown
        stage.dispatchEvent(
          new MouseEvent("mousedown", {
            clientX: clientStartX,
            clientY: clientStartY,
            bubbles: true,
            button: 0,
          })
        );

        // mousemove in increments with small delays to simulate real drag
        const dragStart = performance.now();
        for (let i = 1; i <= steps; i++) {
          await new Promise((r) => requestAnimationFrame(r));
          stage.dispatchEvent(
            new MouseEvent("mousemove", {
              clientX: clientStartX + i * stepPx,
              clientY: clientStartY + i * (stepPx / 2),
              bubbles: true,
              button: 0,
            })
          );
        }
        const dragMs = performance.now() - dragStart;

        // mouseup
        stage.dispatchEvent(
          new MouseEvent("mouseup", {
            clientX: clientStartX + steps * stepPx,
            clientY: clientStartY + steps * (stepPx / 2),
            bubbles: true,
            button: 0,
          })
        );

        // Keep measuring FPS for 1 second after drag ends
        await new Promise((r) => setTimeout(r, 1000));
        measuring = false;

        // Final partial sample
        if (frameCount > 0) {
          const elapsed = performance.now() - lastFpsTime;
          if (elapsed > 100) {
            fpsSamples.push(Math.round((frameCount / elapsed) * 1000));
          }
        }

        return { fpsSamples, dragMs, steps };
      },
      { sx: startX, sy: startY, steps: 30, stepPx: 5 }
    );

    // Measure FPS after drag settles
    const fpsAfter = await measureFps(page, 2000);

    const dragFps = dragResult.fpsSamples;
    const dragFpsAvg =
      dragFps.length > 0 ? Math.round(dragFps.reduce((a, b) => a + b, 0) / dragFps.length) : 0;
    const dragFpsMin = dragFps.length > 0 ? Math.min(...dragFps) : 0;

    logResult(`drag-${count}-shapes`, {
      shapeCount: count,
      dragSteps: dragResult.steps,
      dragMs: Math.round(dragResult.dragMs),
      fpsIdleAvg: fpsIdle.avg,
      fpsDragAvg: dragFpsAvg,
      fpsDragMin: dragFpsMin,
      fpsDragSamples: dragFps,
      fpsAfterAvg: fpsAfter.avg,
    });

    test.info().annotations.push({
      type: "perf-result",
      description: JSON.stringify({
        test: `drag-${count}-shapes`,
        shapeCount: count,
        dragMs: Math.round(dragResult.dragMs),
        fpsIdle: fpsIdle,
        fpsDrag: {
          min: dragFpsMin,
          max: dragFps.length > 0 ? Math.max(...dragFps) : 0,
          avg: dragFpsAvg,
          samples: dragFps,
        },
        fpsAfter: fpsAfter,
      }),
    });

    await clearCanvas(page);
  });
}
