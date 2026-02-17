import { describe, expect, it } from "vitest";
import { getDimensionLabelMetrics } from "@/lib/dimension-label";

describe("getDimensionLabelMetrics", () => {
  it("computes label position and rounded dimensions from bounds", () => {
    const metrics = getDimensionLabelMetrics({ x: 100, y: 50, width: 200.6, height: 24.9 }, 1);

    expect(metrics.width).toBe(201);
    expect(metrics.height).toBe(25);
    expect(metrics.labelX).toBeCloseTo(200.3);
    expect(metrics.labelY).toBeCloseTo(82.9);
    expect(metrics.label).toBe("201 x 25");
  });

  it("scales typography and paddings inversely with viewport scale", () => {
    const zoomedOut = getDimensionLabelMetrics({ x: 0, y: 0, width: 100, height: 50 }, 0.5);
    const zoomedIn = getDimensionLabelMetrics({ x: 0, y: 0, width: 100, height: 50 }, 2);

    expect(zoomedOut.fontSize).toBeGreaterThan(zoomedIn.fontSize);
    expect(zoomedOut.padX).toBeGreaterThan(zoomedIn.padX);
    expect(zoomedOut.padY).toBeGreaterThan(zoomedIn.padY);
  });
});
