import { describe, expect, it } from "vitest";
import type { CircleShape, RectShape, TextShape } from "@/lib/types";
import { buildTransformPatch } from "@/lib/shape-transform";

describe("buildTransformPatch", () => {
  it("builds rect transform patch with min size clamping", () => {
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
      zIndex: 1,
    };

    const patch = buildTransformPatch(rect, {
      x: 25,
      y: 35,
      rotation: 15,
      scaleX: 0.01,
      scaleY: 2,
    });

    expect(patch).toMatchObject({
      x: 25,
      y: 35,
      rotation: 15,
      w: 5,
      h: 100,
    });
  });

  it("builds ellipse patch using independent x/y radii", () => {
    const circle: CircleShape = {
      id: "c1",
      type: "circle",
      x: 100,
      y: 100,
      radiusX: 40,
      radiusY: 20,
      fill: "#000",
      rotation: 0,
      opacity: 1,
      zIndex: 2,
    };

    const patch = buildTransformPatch(circle, {
      x: 110,
      y: 90,
      rotation: 30,
      scaleX: -2,
      scaleY: 0.1,
    });

    expect(patch).toMatchObject({
      x: 110,
      y: 90,
      rotation: 30,
      radiusX: 80,
      radiusY: 5,
    });
  });

  it("builds text patch with width/font clamping", () => {
    const text: TextShape = {
      id: "t1",
      type: "text",
      x: 0,
      y: 0,
      text: "hello",
      fontSize: 24,
      fontFamily: "sans-serif",
      fill: "#111",
      width: 200,
      rotation: 0,
      opacity: 1,
      zIndex: 0,
    };

    const patch = buildTransformPatch(text, {
      x: 20,
      y: 40,
      rotation: 5,
      scaleX: 0.01,
      scaleY: 0.2,
    });

    expect(patch).toMatchObject({
      x: 20,
      y: 40,
      rotation: 5,
      width: 20,
      fontSize: 8,
    });
  });
});

