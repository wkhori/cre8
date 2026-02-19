import { test, expect } from "@playwright/test";
import { signIn, goToBoard, TEST_USERS } from "../helpers/auth";
import { getShapeCount } from "../helpers/shapes";
import { measureFps, logResult } from "../helpers/metrics";
import { waitForStores, waitForShapeCount } from "../helpers/wait";
import { type Page, type BrowserContext } from "@playwright/test";

const USER_KEYS = Object.keys(TEST_USERS);

interface Client {
  context: BrowserContext;
  page: Page;
  key: string;
}

async function setupClients(browser: any, count: number, boardId: string): Promise<Client[]> {
  const clients: Client[] = [];

  // Create contexts and pages in parallel
  const contextPromises = Array.from({ length: count }, () => browser.newContext());
  const contexts = await Promise.all(contextPromises);

  for (let i = 0; i < count; i++) {
    const key = USER_KEYS[i];
    const page = await contexts[i].newPage();
    clients.push({ context: contexts[i], page, key });
  }

  // Sign in all clients in parallel
  await Promise.all(
    clients.map((c) => signIn(c.page, TEST_USERS[c.key].email, TEST_USERS[c.key].password))
  );

  // Navigate all to the same board in parallel
  await Promise.all(clients.map((c) => goToBoard(c.page, boardId)));

  // Wait for stores on all clients in parallel
  await Promise.all(clients.map((c) => waitForStores(c.page)));

  // Stabilization time for Firestore listeners
  await clients[0].page.waitForTimeout(3000);
  await Promise.all(clients.slice(1).map((c) => c.page.waitForTimeout(1000)));

  return clients;
}

async function teardownClients(clients: Client[]): Promise<void> {
  await Promise.all(clients.map((c) => c.context.close()));
}

// ── 5-user and 10-user variations ──────────────────────────────────────

for (const USER_COUNT of [5, 10]) {
  test.describe(`${USER_COUNT}-user concurrency`, () => {
    test.setTimeout(180_000);

    test(`sync fan-out: 1 creates, ${USER_COUNT - 1} observe`, async ({ browser }) => {
      const boardId = `perf-fanout-${USER_COUNT}-${Date.now()}`;
      const clients = await setupClients(browser, USER_COUNT, boardId);

      const SHAPES_TO_CREATE = 5;
      const latencies: number[][] = Array.from({ length: USER_COUNT - 1 }, () => []);

      for (let i = 0; i < SHAPES_TO_CREATE; i++) {
        // Get baseline counts for all observers
        const beforeCounts = await Promise.all(clients.slice(1).map((c) => getShapeCount(c.page)));

        const createTime = Date.now();

        // Client 0 creates a shape
        await clients[0].page.evaluate((idx: number) => {
          const store = (window as any).__cre8?.canvas;
          store.getState().addRect(200 + idx * 60, 200);
        }, i);

        // Poll all observers until they see the new shape
        const observerPromises = clients.slice(1).map(async (client, oi) => {
          const target = beforeCounts[oi] + 1;
          while (Date.now() - createTime < 15_000) {
            const count = await getShapeCount(client.page);
            if (count >= target) {
              latencies[oi].push(Date.now() - createTime);
              return;
            }
            await client.page.waitForTimeout(50);
          }
          latencies[oi].push(-1); // timeout
        });

        await Promise.all(observerPromises);
      }

      // Compute per-observer averages
      const observerAvgs = latencies.map((obs) => {
        const valid = obs.filter((l) => l > 0);
        return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : -1;
      });
      const allValid = latencies.flat().filter((l) => l > 0);
      const overallAvg = allValid.length
        ? Math.round(allValid.reduce((a, b) => a + b, 0) / allValid.length)
        : -1;
      const timeouts = latencies.flat().filter((l) => l === -1).length;

      logResult(`fanout-${USER_COUNT}-users`, {
        userCount: USER_COUNT,
        shapesCreated: SHAPES_TO_CREATE,
        overallAvgMs: overallAvg,
        maxMs: allValid.length ? Math.max(...allValid) : -1,
        minMs: allValid.length ? Math.min(...allValid) : -1,
        observerAvgsMs: observerAvgs,
        timeouts,
      });

      test.info().annotations.push({
        type: "perf-result",
        description: JSON.stringify({
          test: `fanout-${USER_COUNT}-users`,
          userCount: USER_COUNT,
          overallAvgMs: overallAvg,
          maxMs: allValid.length ? Math.max(...allValid) : -1,
          timeouts,
        }),
      });

      expect(timeouts).toBe(0);

      await teardownClients(clients);
    });

    test(`concurrent writes: ${USER_COUNT} users creating simultaneously`, async ({ browser }) => {
      const boardId = `perf-concurrent-${USER_COUNT}-${Date.now()}`;
      const clients = await setupClients(browser, USER_COUNT, boardId);

      const SHAPES_PER_USER = 10;
      const expectedTotal = USER_COUNT * SHAPES_PER_USER;

      // All users create shapes at the same time
      const createStart = Date.now();
      await Promise.all(
        clients.map((client, userIdx) =>
          client.page.evaluate(
            ({ count, offset }: { count: number; offset: number }) => {
              const store = (window as any).__cre8?.canvas;
              const state = store.getState();
              for (let i = 0; i < count; i++) {
                state.addRect(100 + offset * 200 + (i % 5) * 60, 100 + Math.floor(i / 5) * 60);
              }
            },
            { count: SHAPES_PER_USER, offset: userIdx }
          )
        )
      );
      const createMs = Date.now() - createStart;

      // Wait for all clients to sync to the expected total
      const syncStart = Date.now();
      await Promise.all(clients.map((c) => waitForShapeCount(c.page, expectedTotal, 60_000)));
      const syncMs = Date.now() - syncStart;

      // Verify all clients converged to the same count
      const finalCounts = await Promise.all(clients.map((c) => getShapeCount(c.page)));
      const allSynced = finalCounts.every((c) => c >= expectedTotal);

      logResult(`concurrent-writes-${USER_COUNT}-users`, {
        userCount: USER_COUNT,
        shapesPerUser: SHAPES_PER_USER,
        expectedTotal,
        createMs,
        syncMs,
        finalCounts,
        allSynced,
      });

      test.info().annotations.push({
        type: "perf-result",
        description: JSON.stringify({
          test: `concurrent-writes-${USER_COUNT}-users`,
          userCount: USER_COUNT,
          expectedTotal,
          createMs,
          syncMs,
          allSynced,
        }),
      });

      expect(allSynced).toBe(true);

      await teardownClients(clients);
    });

    test(`combined workload: ${USER_COUNT} users pan + create + move`, async ({ browser }) => {
      const boardId = `perf-workload-${USER_COUNT}-${Date.now()}`;
      const clients = await setupClients(browser, USER_COUNT, boardId);

      // Seed some initial shapes from client 0
      await clients[0].page.evaluate(() => {
        const store = (window as any).__cre8?.canvas;
        const state = store.getState();
        for (let i = 0; i < 50; i++) {
          state.addRect(100 + (i % 10) * 60, 100 + Math.floor(i / 10) * 60);
        }
      });

      // Wait for all to sync the seed shapes
      await Promise.all(clients.map((c) => waitForShapeCount(c.page, 50, 30_000)));
      await clients[0].page.waitForTimeout(1000);

      // Measure FPS before workload
      const fpsBeforeAll = await Promise.all(clients.map((c) => measureFps(c.page, 2000)));
      const avgFpsBefore = Math.round(
        fpsBeforeAll.reduce((a, b) => a + b.avg, 0) / fpsBeforeAll.length
      );

      // Simulate concurrent workload:
      // - Even-indexed users create shapes
      // - Odd-indexed users pan (wheel events)
      const workloadStart = Date.now();
      await Promise.all(
        clients.map(async (client, idx) => {
          if (idx % 2 === 0) {
            // Create 10 shapes
            await client.page.evaluate((offset: number) => {
              const store = (window as any).__cre8?.canvas;
              const state = store.getState();
              for (let i = 0; i < 10; i++) {
                state.addRect(500 + offset * 150 + i * 40, 300);
              }
            }, idx);
          } else {
            // Pan around
            const canvas = client.page.locator("canvas").first();
            const box = await canvas.boundingBox();
            if (box) {
              await client.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
              for (let i = 0; i < 10; i++) {
                await client.page.mouse.wheel(30, 0);
                await client.page.waitForTimeout(50);
              }
            }
          }
        })
      );
      const workloadMs = Date.now() - workloadStart;

      // Count shapes created by even-indexed users
      const creatorsCount = clients.filter((_, i) => i % 2 === 0).length;
      const expectedExtra = creatorsCount * 10;
      const expectedTotal = 50 + expectedExtra;

      // Wait for all to converge
      await Promise.all(clients.map((c) => waitForShapeCount(c.page, expectedTotal, 60_000)));

      // Measure FPS after workload
      const fpsAfterAll = await Promise.all(clients.map((c) => measureFps(c.page, 2000)));
      const avgFpsAfter = Math.round(
        fpsAfterAll.reduce((a, b) => a + b.avg, 0) / fpsAfterAll.length
      );

      const finalCounts = await Promise.all(clients.map((c) => getShapeCount(c.page)));

      logResult(`workload-${USER_COUNT}-users`, {
        userCount: USER_COUNT,
        seedShapes: 50,
        newShapes: expectedExtra,
        expectedTotal,
        workloadMs,
        avgFpsBefore,
        avgFpsAfter,
        fpsMinAfter: Math.min(...fpsAfterAll.map((f) => f.min)),
        finalCounts,
      });

      test.info().annotations.push({
        type: "perf-result",
        description: JSON.stringify({
          test: `workload-${USER_COUNT}-users`,
          userCount: USER_COUNT,
          expectedTotal,
          workloadMs,
          avgFpsBefore,
          avgFpsAfter,
          allSynced: finalCounts.every((c) => c >= expectedTotal),
        }),
      });

      expect(finalCounts.every((c) => c >= expectedTotal)).toBe(true);

      await teardownClients(clients);
    });
  });
}
