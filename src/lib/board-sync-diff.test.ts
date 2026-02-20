import { describe, expect, it } from "vitest";
import type { CircleShape, RectShape } from "@/lib/types";
import { diffShapeWrites } from "@/lib/board-sync-diff";

const makeRect = (id: string, x = 0, y = 0): RectShape => ({
  id,
  type: "rect",
  x,
  y,
  w: 100,
  h: 60,
  fill: "#f59e0b",
  rotation: 0,
  opacity: 1,
  zIndex: 1,
});

const makeCircle = (id: string, x = 0, y = 0): CircleShape => ({
  id,
  type: "circle",
  x,
  y,
  radiusX: 40,
  radiusY: 40,
  fill: "#ec4899",
  rotation: 0,
  opacity: 1,
  zIndex: 2,
});

describe("diffShapeWrites", () => {
  it("detects added and deleted shapes", () => {
    const prev = [makeRect("r1"), makeCircle("c1")];
    const curr = [makeRect("r1"), makeRect("r2")];

    const result = diffShapeWrites(prev, curr);
    expect(result.added.map((shape) => shape.id)).toEqual(["r2"]);
    expect(result.deleted).toEqual(["c1"]);
    expect(result.modified).toEqual([]);
  });

  it("creates minimal patches for modified shapes", () => {
    const prevRect = makeRect("r1", 10, 20);
    const currRect = { ...prevRect, x: 30, fill: "#22c55e" };

    const result = diffShapeWrites([prevRect], [currRect]);
    expect(result.added).toEqual([]);
    expect(result.deleted).toEqual([]);
    expect(result.modified).toEqual([{ id: "r1", patch: { x: 30, fill: "#22c55e" } }]);
  });

  it("ignores unchanged shapes when references are stable", () => {
    const rect = makeRect("r1", 10, 20);
    const result = diffShapeWrites([rect], [rect]);
    expect(result).toEqual({ added: [], deleted: [], modified: [] });
  });
});
