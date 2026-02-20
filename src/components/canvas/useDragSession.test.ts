import { describe, expect, it } from "vitest";
import { computeDragPositions } from "./useDragSession";

describe("computeDragPositions", () => {
  it("keeps group offsets when drag events come from a non-anchor shape", () => {
    const basePositions = new Map<string, { x: number; y: number }>([
      ["a", { x: 10, y: 20 }],
      ["b", { x: 60, y: 120 }],
    ]);

    const positions = computeDragPositions(basePositions, "b", 100, 180);
    expect(positions).not.toBeNull();
    expect(positions?.get("a")).toEqual({ x: 50, y: 80 });
    expect(positions?.get("b")).toEqual({ x: 100, y: 180 });
  });

  it("returns null when moved shape is not in the base position map", () => {
    const basePositions = new Map<string, { x: number; y: number }>([["a", { x: 0, y: 0 }]]);

    expect(computeDragPositions(basePositions, "missing", 10, 10)).toBeNull();
  });
});
