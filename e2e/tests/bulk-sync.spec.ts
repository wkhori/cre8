import { test, expect } from "@playwright/test";
import { signIn, goToBoard, TEST_USERS } from "../helpers/auth";
import { getShapeCount } from "../helpers/shapes";
import { logResult } from "../helpers/metrics";
import { waitForStores, waitForShapeCount } from "../helpers/wait";

test("bulk sync: 100 shapes from A to B", async ({ browser }) => {
  const boardId = `perf-bulk-sync-${Date.now()}`;

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await signIn(pageA, TEST_USERS.a.email, TEST_USERS.a.password);
  await signIn(pageB, TEST_USERS.b.email, TEST_USERS.b.password);

  await goToBoard(pageA, boardId);
  await goToBoard(pageB, boardId);
  await waitForStores(pageA);
  await waitForStores(pageB);

  // Extra stabilization
  await pageA.waitForTimeout(3000);
  await pageB.waitForTimeout(1000);

  // A creates 100 shapes rapidly
  const createMs = await pageA.evaluate(() => {
    const store = (window as any).__cre8?.canvas;
    if (!store) throw new Error("Store not found");
    const state = store.getState();
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      state.addRect(50 + (i % 10) * 80, 50 + Math.floor(i / 10) * 80);
    }
    return performance.now() - start;
  });

  // Wait for B to receive all 100
  const syncStart = Date.now();
  await waitForShapeCount(pageB, 100, 60_000);
  const syncMs = Date.now() - syncStart;

  const countB = await getShapeCount(pageB);
  expect(countB).toBeGreaterThanOrEqual(100);

  logResult("bulk-sync-100", {
    createMs: Math.round(createMs),
    syncMs,
    finalCountA: await getShapeCount(pageA),
    finalCountB: countB,
  });

  test.info().annotations.push({
    type: "perf-result",
    description: JSON.stringify({
      test: "bulk-sync-100",
      createMs: Math.round(createMs),
      syncMs,
      finalCountB: countB,
    }),
  });

  await contextA.close();
  await contextB.close();
});
