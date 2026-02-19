import { test, expect } from "@playwright/test";
import { signIn, goToBoard, TEST_USERS } from "../helpers/auth";
import { injectRects, clearCanvas } from "../helpers/shapes";
import { measureFps, logResult } from "../helpers/metrics";
import { waitForStores, waitForFpsStable } from "../helpers/wait";

test("render 500 shapes during pan", async ({ page }) => {
  await signIn(page, TEST_USERS.a.email, TEST_USERS.a.password);
  await goToBoard(page, "perf-render-pan");
  await waitForStores(page);

  await injectRects(page, 500);
  await waitForFpsStable(page);

  // Baseline FPS (idle)
  const fpsIdle = await measureFps(page, 2000);

  // Simulate pan by scrolling horizontally with shift+wheel
  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas not found");

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  // Pan: move mouse to center, then use wheel events
  await page.mouse.move(centerX, centerY);
  const panStart = Date.now();
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(50, 0);
    await page.waitForTimeout(50);
  }
  const panMs = Date.now() - panStart;

  const fpsPan = await measureFps(page, 2000);

  logResult("render-pan-500", {
    shapeCount: 500,
    panMs,
    fpsIdleAvg: fpsIdle.avg,
    fpsPanAvg: fpsPan.avg,
    fpsPanMin: fpsPan.min,
  });

  test.info().annotations.push({
    type: "perf-result",
    description: JSON.stringify({ test: "render-pan-500", fpsIdle, fpsPan }),
  });

  await clearCanvas(page);
});

test("render 500 shapes during zoom", async ({ page }) => {
  await signIn(page, TEST_USERS.a.email, TEST_USERS.a.password);
  await goToBoard(page, "perf-render-zoom");
  await waitForStores(page);

  await injectRects(page, 500);
  await waitForFpsStable(page);

  const fpsIdle = await measureFps(page, 2000);

  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas not found");

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  await page.mouse.move(centerX, centerY);

  // Zoom in
  const zoomStart = Date.now();
  for (let i = 0; i < 15; i++) {
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(80);
  }
  // Zoom back out
  for (let i = 0; i < 15; i++) {
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(80);
  }
  const zoomMs = Date.now() - zoomStart;

  const fpsZoom = await measureFps(page, 2000);

  logResult("render-zoom-500", {
    shapeCount: 500,
    zoomMs,
    fpsIdleAvg: fpsIdle.avg,
    fpsZoomAvg: fpsZoom.avg,
    fpsZoomMin: fpsZoom.min,
  });

  test.info().annotations.push({
    type: "perf-result",
    description: JSON.stringify({ test: "render-zoom-500", fpsIdle, fpsZoom }),
  });

  await clearCanvas(page);
});
