import type { Shape } from "@/lib/types";

export interface ShapeTransformInput {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export function buildTransformPatch(
  shape: Shape,
  input: ShapeTransformInput
): Partial<Shape> {
  const patch: Record<string, unknown> = {
    x: input.x,
    y: input.y,
    rotation: input.rotation,
  };

  if (shape.type === "rect") {
    patch.w = Math.max(5, shape.w * input.scaleX);
    patch.h = Math.max(5, shape.h * input.scaleY);
    return patch as Partial<Shape>;
  }

  if (shape.type === "circle") {
    patch.radiusX = Math.max(5, shape.radiusX * Math.abs(input.scaleX));
    patch.radiusY = Math.max(5, shape.radiusY * Math.abs(input.scaleY));
    return patch as Partial<Shape>;
  }

  if (shape.type === "text") {
    patch.fontSize = Math.max(8, Math.round(shape.fontSize * input.scaleY));
    patch.width = Math.max(20, (shape.width ?? 200) * input.scaleX);
    return patch as Partial<Shape>;
  }

  if (shape.type === "sticky" || shape.type === "frame") {
    patch.w = Math.max(5, shape.w * input.scaleX);
    patch.h = Math.max(5, shape.h * input.scaleY);
    return patch as Partial<Shape>;
  }

  return patch as Partial<Shape>;
}

