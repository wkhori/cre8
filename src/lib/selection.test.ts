import { describe, expect, it } from "vitest";
import type { RectShape, CircleShape, TextShape } from "@/lib/types";
import { getSelectionHitIds, intersectsSelectionBox } from "@/lib/selection";

const rect: RectShape = {
  id: "rect-1",
  type: "rect",
  x: 20,
  y: 20,
  w: 80,
  h: 40,
  fill: "#f97316",
  rotation: 0,
  opacity: 1,
  zIndex: 1,
};

const ellipse: CircleShape = {
  id: "ellipse-1",
  type: "circle",
  x: 200,
  y: 120,
  radiusX: 60,
  radiusY: 30,
  fill: "#3b82f6",
  rotation: 0,
  opacity: 1,
  zIndex: 2,
};

const text: TextShape = {
  id: "text-1",
  type: "text",
  x: 320,
  y: 60,
  text: "Hello",
  fontSize: 24,
  fontFamily: "sans-serif",
  fill: "#111",
  width: 120,
  rotation: 0,
  opacity: 1,
  zIndex: 3,
};

describe("selection helpers", () => {
  it("correctly detects intersection against center-based ellipses", () => {
    const hitBox = { x: 150, y: 90, w: 30, h: 20 };
    const missBox = { x: 10, y: 10, w: 20, h: 20 };

    expect(intersectsSelectionBox(hitBox, ellipse)).toBe(true);
    expect(intersectsSelectionBox(missBox, ellipse)).toBe(false);
  });

  it("returns ids for all intersecting shapes", () => {
    const ids = getSelectionHitIds([rect, ellipse, text], {
      x: 0,
      y: 0,
      w: 250,
      h: 200,
    });

    expect(ids).toEqual(["rect-1", "ellipse-1"]);
  });
});
