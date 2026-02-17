import { describe, expect, it } from "vitest";
import type { CircleShape, RectShape, LineShape } from "@/lib/types";
import { getShapeBounds } from "@/lib/shape-geometry";

describe("getShapeBounds", () => {
  it("returns position and size for a rect", () => {
    const rect: RectShape = {
      id: "r1",
      type: "rect",
      x: 10,
      y: 20,
      w: 100,
      h: 50,
      fill: "#000",
      rotation: 0,
      opacity: 1,
      zIndex: 0,
    };
    expect(getShapeBounds(rect)).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it("returns center-offset bounds for a circle", () => {
    const circle: CircleShape = {
      id: "c1",
      type: "circle",
      x: 100,
      y: 100,
      radiusX: 30,
      radiusY: 20,
      fill: "#000",
      rotation: 0,
      opacity: 1,
      zIndex: 0,
    };
    expect(getShapeBounds(circle)).toEqual({ x: 70, y: 80, width: 60, height: 40 });
  });

  it("includes stroke padding for a line", () => {
    const line: LineShape = {
      id: "l1",
      type: "line",
      x: 0,
      y: 0,
      points: [0, 0, 100, 50],
      stroke: "#000",
      strokeWidth: 4,
      rotation: 0,
      opacity: 1,
      zIndex: 0,
    };
    const bounds = getShapeBounds(line);
    expect(bounds).toEqual({ x: -2, y: -2, width: 104, height: 54 });
  });
});
