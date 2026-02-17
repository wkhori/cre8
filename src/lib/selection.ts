import type { Shape } from "@/lib/types";
import { getShapeBounds } from "@/lib/shape-geometry";

export interface SelectionBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function intersectsSelectionBox(box: SelectionBox, shape: Shape): boolean {
  const bounds = getShapeBounds(shape);
  return (
    bounds.x + bounds.width > box.x &&
    bounds.x < box.x + box.w &&
    bounds.y + bounds.height > box.y &&
    bounds.y < box.y + box.h
  );
}

export function getSelectionHitIds(shapes: Shape[], box: SelectionBox): string[] {
  return shapes.filter((shape) => intersectsSelectionBox(box, shape)).map((shape) => shape.id);
}
