import { test, expect } from "@playwright/test";
import { signIn, goToBoard, TEST_USERS } from "../helpers/auth";
import { getShapeCount } from "../helpers/shapes";
import { logResult } from "../helpers/metrics";
import { waitForStores } from "../helpers/wait";

test("sync latency: single shape creation between 2 clients", async ({ browser }) => {
  const boardId = `perf-sync-${Date.now()}`;

  // Set up two browser contexts (two separate users)
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  // Sign in both users
  await signIn(pageA, TEST_USERS.a.email, TEST_USERS.a.password);
  await signIn(pageB, TEST_USERS.b.email, TEST_USERS.b.password);

  // Navigate both to the same board
  await goToBoard(pageA, boardId);
  await goToBoard(pageB, boardId);
  await waitForStores(pageA);
  await waitForStores(pageB);

  // Extra stabilization time for Firestore listeners
  await pageA.waitForTimeout(3000);
  await pageB.waitForTimeout(1000);

  // Measure sync latency: A creates a shape, measure time until B sees it
  const latencies: number[] = [];
  for (let i = 0; i < 5; i++) {
    const beforeCount = await getShapeCount(pageB);
    const createTime = Date.now();

    // A creates a shape
    await pageA.evaluate((idx: number) => {
      const store = (window as any).__cre8?.canvas;
      store.getState().addRect(200 + idx * 50, 200);
    }, i);

    // Poll B until object count increments
    let latency = -1;
    while (Date.now() - createTime < 10_000) {
      const count = await getShapeCount(pageB);
      if (count > beforeCount) {
        latency = Date.now() - createTime;
        break;
      }
      await pageB.waitForTimeout(50);
    }
    latencies.push(latency);
  }

  const validLatencies = latencies.filter((l) => l > 0);
  const avgMs = validLatencies.length
    ? Math.round(validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length)
    : -1;

  logResult("sync-latency-2-clients", {
    latenciesMs: latencies,
    avgMs,
    minMs: validLatencies.length ? Math.min(...validLatencies) : -1,
    maxMs: validLatencies.length ? Math.max(...validLatencies) : -1,
    timeouts: latencies.filter((l) => l === -1).length,
  });

  test.info().annotations.push({
    type: "perf-result",
    description: JSON.stringify({
      test: "sync-latency-2-clients",
      latencies,
      avgMs,
    }),
  });

  // All should have synced
  expect(latencies.filter((l) => l === -1).length).toBe(0);

  await contextA.close();
  await contextB.close();
});
