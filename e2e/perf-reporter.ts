import * as fs from "fs";
import * as path from "path";
import type { Reporter, TestCase, TestResult, FullResult } from "@playwright/test/reporter";

const RESULTS_DIR = path.join(__dirname, "perf-results");
const LATEST_PATH = path.join(RESULTS_DIR, "latest.json");
const HISTORY_PATH = path.join(RESULTS_DIR, "history.jsonl");

interface PerfEntry {
  test: string;
  [key: string]: unknown;
}

/**
 * Custom Playwright reporter that:
 * 1. Extracts perf-result annotations from tests
 * 2. Writes latest.json (overwritten each run)
 * 3. Appends to history.jsonl (one line per run, persists across runs)
 * 4. Prints a formatted summary table to console
 */
export default class PerfReporter implements Reporter {
  private results: PerfEntry[] = [];

  onTestEnd(test: TestCase, result: TestResult) {
    for (const annotation of result.annotations) {
      if (annotation.type === "perf-result" && annotation.description) {
        try {
          const data = JSON.parse(annotation.description);
          this.results.push(data);
        } catch {
          // skip invalid JSON
        }
      }
    }
  }

  onEnd(result: FullResult) {
    if (this.results.length === 0) return;

    // Ensure output directory exists
    if (!fs.existsSync(RESULTS_DIR)) {
      fs.mkdirSync(RESULTS_DIR, { recursive: true });
    }

    const run = {
      timestamp: new Date().toISOString(),
      status: result.status,
      durationMs: result.duration,
      results: this.results,
    };

    // Write latest.json (overwritten each run)
    fs.writeFileSync(LATEST_PATH, JSON.stringify(run, null, 2));

    // Append to history.jsonl (one line per run)
    fs.appendFileSync(HISTORY_PATH, JSON.stringify(run) + "\n");

    // Print summary table
    console.log("\n" + "=".repeat(72));
    console.log("  PERFORMANCE RESULTS");
    console.log("  " + new Date().toLocaleString());
    console.log("=".repeat(72));

    const targets: Record<
      string,
      {
        metric: string;
        target: string;
        extract: (d: PerfEntry) => string;
        pass: (d: PerfEntry) => boolean;
      }
    > = {
      "bulk-create-100": {
        metric: "FPS after",
        target: "> 30",
        extract: (d) => `${(d.fpsAfter as any)?.avg ?? "?"} avg`,
        pass: (d) => ((d.fpsAfter as any)?.avg ?? 0) > 30,
      },
      "bulk-create-250": {
        metric: "FPS after",
        target: "> 30",
        extract: (d) =>
          `${(d.fpsAfter as any)?.avg ?? "?"} avg (min ${(d.fpsAfter as any)?.min ?? "?"})`,
        pass: (d) => ((d.fpsAfter as any)?.avg ?? 0) > 30,
      },
      "bulk-create-500": {
        metric: "FPS after",
        target: "> 30",
        extract: (d) =>
          `${(d.fpsAfter as any)?.avg ?? "?"} avg (min ${(d.fpsAfter as any)?.min ?? "?"})`,
        pass: (d) => ((d.fpsAfter as any)?.avg ?? 0) > 30,
      },
      "duplicate-250-to-500": {
        metric: "FPS after",
        target: "> 30",
        extract: (d) => `${(d.fpsAfter as any)?.avg ?? "?"} avg`,
        pass: (d) => ((d.fpsAfter as any)?.avg ?? 0) > 30,
      },
      "duplicate-500-to-1000": {
        metric: "FPS after",
        target: "> 30",
        extract: (d) =>
          `${(d.fpsAfter as any)?.avg ?? "?"} avg (min ${(d.fpsAfter as any)?.min ?? "?"})`,
        pass: (d) => ((d.fpsAfter as any)?.avg ?? 0) > 30,
      },
      "bulk-move-500": {
        metric: "FPS before",
        target: "> 20",
        extract: (d) => `${(d.fpsBefore as any)?.avg ?? "?"} avg`,
        pass: (d) => ((d.fpsBefore as any)?.avg ?? 0) > 20,
      },
      "bulk-move-keys-500": {
        metric: "Nudge time",
        target: "< 5s total",
        extract: (d) => `${d.totalMs ?? "?"}ms`,
        pass: (d) => ((d.totalMs as number) ?? 99999) < 5000,
      },
      "render-pan-500": {
        metric: "Idle FPS",
        target: "> 30",
        extract: (d) => `${(d.fpsIdle as any)?.avg ?? "?"} avg`,
        pass: (d) => ((d.fpsIdle as any)?.avg ?? 0) > 30,
      },
      "render-zoom-500": {
        metric: "Idle FPS",
        target: "> 30",
        extract: (d) => `${(d.fpsIdle as any)?.avg ?? "?"} avg`,
        pass: (d) => ((d.fpsIdle as any)?.avg ?? 0) > 30,
      },
      "sync-latency-2-clients": {
        metric: "Avg latency",
        target: "< 2000ms",
        extract: (d) => `${d.avgMs ?? "?"}ms`,
        pass: (d) => ((d.avgMs as number) ?? 99999) < 2000,
      },
      "bulk-sync-100": {
        metric: "Sync time",
        target: "< 30s",
        extract: (d) => `${d.syncMs ?? "?"}ms`,
        pass: (d) => ((d.syncMs as number) ?? 99999) < 30000,
      },
      "fanout-5-users": {
        metric: "Avg latency",
        target: "< 3000ms",
        extract: (d) => `${d.overallAvgMs ?? "?"}ms (max ${d.maxMs ?? "?"}ms)`,
        pass: (d) => ((d.overallAvgMs as number) ?? 99999) < 3000,
      },
      "fanout-10-users": {
        metric: "Avg latency",
        target: "< 5000ms",
        extract: (d) => `${d.overallAvgMs ?? "?"}ms (max ${d.maxMs ?? "?"}ms)`,
        pass: (d) => ((d.overallAvgMs as number) ?? 99999) < 5000,
      },
      "concurrent-writes-5-users": {
        metric: "Sync time",
        target: "< 30s",
        extract: (d) => `${d.syncMs ?? "?"}ms (${d.allSynced ? "synced" : "MISMATCH"})`,
        pass: (d) => ((d.syncMs as number) ?? 99999) < 30000 && d.allSynced === true,
      },
      "concurrent-writes-10-users": {
        metric: "Sync time",
        target: "< 60s",
        extract: (d) => `${d.syncMs ?? "?"}ms (${d.allSynced ? "synced" : "MISMATCH"})`,
        pass: (d) => ((d.syncMs as number) ?? 99999) < 60000 && d.allSynced === true,
      },
      "workload-5-users": {
        metric: "Avg FPS after",
        target: "> 20",
        extract: (d) => `${d.avgFpsAfter ?? "?"} avg (before: ${d.avgFpsBefore ?? "?"})`,
        pass: (d) => ((d.avgFpsAfter as number) ?? 0) > 20,
      },
      "workload-10-users": {
        metric: "Avg FPS after",
        target: "> 15",
        extract: (d) => `${d.avgFpsAfter ?? "?"} avg (before: ${d.avgFpsBefore ?? "?"})`,
        pass: (d) => ((d.avgFpsAfter as number) ?? 0) > 15,
      },
    };

    // Header
    const cols = ["Test", "Metric", "Result", "Target", "Status"];
    const widths = [32, 14, 34, 12, 6];
    const header = cols.map((c, i) => c.padEnd(widths[i])).join(" ");
    console.log("\n" + header);
    console.log("-".repeat(header.length));

    for (const entry of this.results) {
      const name = entry.test as string;
      const info = targets[name];
      if (!info) {
        console.log(`  ${name}: ${JSON.stringify(entry)}`);
        continue;
      }
      const result = info.extract(entry);
      const passed = info.pass(entry);
      const status = passed ? "OK" : "FAIL";
      const row = [
        name.padEnd(widths[0]),
        info.metric.padEnd(widths[1]),
        result.padEnd(widths[2]),
        info.target.padEnd(widths[3]),
        status,
      ].join(" ");
      console.log(row);
    }

    console.log("\n" + "=".repeat(72));
    console.log(`  Results saved to: ${LATEST_PATH}`);
    console.log(`  History appended to: ${HISTORY_PATH}`);
    console.log("=".repeat(72) + "\n");
  }
}
