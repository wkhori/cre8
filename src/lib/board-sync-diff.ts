import type { Shape } from "@/lib/types";

export interface ShapeWriteBatch {
  added: Shape[];
  deleted: string[];
  modified: Array<{ id: string; patch: Partial<Shape> }>;
}

export function diffShapeWrites(prevShapes: Shape[], currShapes: Shape[]): ShapeWriteBatch {
  const prevMap = new Map(prevShapes.map((shape) => [shape.id, shape]));
  const currMap = new Map(currShapes.map((shape) => [shape.id, shape]));

  const added: Shape[] = [];
  for (const shape of currShapes) {
    if (!prevMap.has(shape.id)) added.push(shape);
  }

  const deleted: string[] = [];
  for (const shape of prevShapes) {
    if (!currMap.has(shape.id)) deleted.push(shape.id);
  }

  const modified: Array<{ id: string; patch: Partial<Shape> }> = [];
  for (const shape of currShapes) {
    const prev = prevMap.get(shape.id);
    if (!prev || prev === shape) continue;

    const patch: Partial<Shape> = {};
    for (const key of Object.keys(shape) as (keyof Shape)[]) {
      if (shape[key] !== prev[key]) {
        (patch as Record<string, unknown>)[key] = shape[key];
      }
    }

    if (Object.keys(patch).length > 0) {
      modified.push({ id: shape.id, patch });
    }
  }

  return { added, deleted, modified };
}
