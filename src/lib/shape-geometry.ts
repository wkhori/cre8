import type { Shape } from "@/lib/types";

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Compute min/max extents of a flat [x,y,x,y,...] points array. */
function pointsBounds(points: number[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = points[0], maxX = points[0];
  let minY = points[1], maxY = points[1];
  for (let i = 2; i < points.length; i += 2) {
    if (points[i] < minX) minX = points[i];
    if (points[i] > maxX) maxX = points[i];
    if (points[i + 1] < minY) minY = points[i + 1];
    if (points[i + 1] > maxY) maxY = points[i + 1];
  }
  return { minX, minY, maxX, maxY };
}

export function getShapeBounds(shape: Shape): Bounds {
  if (shape.type === "rect") {
    return { x: shape.x, y: shape.y, width: shape.w, height: shape.h };
  }

  if (shape.type === "circle") {
    return {
      x: shape.x - shape.radiusX,
      y: shape.y - shape.radiusY,
      width: shape.radiusX * 2,
      height: shape.radiusY * 2,
    };
  }

  if (shape.type === "text") {
    return {
      x: shape.x,
      y: shape.y,
      width: shape.width ?? 200,
      height: shape.fontSize,
    };
  }

  if (shape.type === "sticky" || shape.type === "frame") {
    return { x: shape.x, y: shape.y, width: shape.w, height: shape.h };
  }

  // Connector and Line both use points-based bounds
  const pts = shape.type === "connector"
    ? (shape.points ?? [0, 0, 100, 0])
    : shape.points;

  if (pts.length < 2) {
    return { x: shape.x, y: shape.y, width: 0, height: 0 };
  }

  const { minX, minY, maxX, maxY } = pointsBounds(pts);
  const pad = shape.type === "line" ? shape.strokeWidth / 2 : 0;

  return {
    x: shape.x + minX - pad,
    y: shape.y + minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}
