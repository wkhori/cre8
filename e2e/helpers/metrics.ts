import { type Page } from "@playwright/test";

export interface PerfMetrics {
  fps: number;
  frameMs: number;
  objectCount: number;
  konvaNodeCount: number;
  interaction: string;
}

export interface FpsSample {
  min: number;
  max: number;
  avg: number;
  samples: number[];
}

/**
 * Read current metrics from the debug store.
 */
export async function getMetrics(page: Page): Promise<PerfMetrics> {
  return page.evaluate(() => {
    const store = (window as any).__cre8?.debug;
    if (!store) throw new Error("__cre8.debug store not found on window");
    const s = store.getState();
    return {
      fps: s.fps,
      frameMs: s.frameMs,
      objectCount: s.objectCount,
      konvaNodeCount: s.konvaNodeCount,
      interaction: s.interaction,
    };
  });
}

/**
 * Get just the object count from debug store.
 */
export async function getObjectCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const store = (window as any).__cre8?.debug;
    return store?.getState().objectCount ?? 0;
  });
}

/**
 * Measure FPS directly using requestAnimationFrame inside the browser.
 * The debug store FPS counter only runs when DebugDashboard is mounted,
 * so we run our own rAF loop for accurate headless measurement.
 */
export async function measureFps(page: Page, durationMs: number): Promise<FpsSample> {
  const samples = await page.evaluate((duration: number) => {
    return new Promise<number[]>((resolve) => {
      const fpsSamples: number[] = [];
      let frameCount = 0;
      let lastTime = performance.now();
      const startTime = performance.now();

      // Safety timeout: resolve even if rAF stops firing
      const safetyTimeout = setTimeout(() => {
        if (frameCount > 0) {
          const elapsed = performance.now() - lastTime;
          if (elapsed > 50) {
            fpsSamples.push(Math.round((frameCount / elapsed) * 1000));
          }
        }
        resolve(fpsSamples);
      }, duration + 5000);

      function loop(now: number) {
        frameCount++;
        const elapsed = now - lastTime;

        // Record FPS every 500ms
        if (elapsed >= 500) {
          const fps = Math.round((frameCount / elapsed) * 1000);
          fpsSamples.push(fps);
          frameCount = 0;
          lastTime = now;
        }

        if (now - startTime < duration) {
          requestAnimationFrame(loop);
        } else {
          clearTimeout(safetyTimeout);
          // Final partial window
          if (frameCount > 0) {
            const elapsed2 = now - lastTime;
            if (elapsed2 > 100) {
              fpsSamples.push(Math.round((frameCount / elapsed2) * 1000));
            }
          }
          resolve(fpsSamples);
        }
      }

      requestAnimationFrame(loop);
    });
  }, durationMs);

  if (samples.length === 0) return { min: 0, max: 0, avg: 0, samples: [] };
  return {
    min: Math.min(...samples),
    max: Math.max(...samples),
    avg: Math.round(samples.reduce((a, b) => a + b, 0) / samples.length),
    samples,
  };
}

/**
 * Log a performance result as a formatted table row.
 */
export function logResult(label: string, data: Record<string, unknown>): void {
  console.log(`\n=== PERF: ${label} ===`);
  for (const [key, value] of Object.entries(data)) {
    const formatted = typeof value === "object" ? JSON.stringify(value) : String(value);
    console.log(`  ${key}: ${formatted}`);
  }
}
