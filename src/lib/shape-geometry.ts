import type { Shape, ConnectorShape } from "@/lib/types";

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Compute min/max extents of a flat [x,y,x,y,...] points array. */
function pointsBounds(points: number[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = points[0],
    maxX = points[0];
  let minY = points[1],
    maxY = points[1];
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

  if (shape.type === "sticky" || shape.type === "frame" || shape.type === "image") {
    return { x: shape.x, y: shape.y, width: shape.w, height: shape.h };
  }

  // Connector and Line both use points-based bounds
  const pts = shape.points ?? [0, 0, 100, 0];

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

/** Find where a ray from center toward target intersects the bounding rect. */
export function edgeIntersection(
  bounds: Bounds,
  cx: number,
  cy: number,
  tx: number,
  ty: number
): { x: number; y: number } {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  const hw = bounds.width / 2;
  const hh = bounds.height / 2;

  const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);

  return { x: cx + dx * s, y: cy + dy * s };
}

function ellipseEdgeIntersection(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  tx: number,
  ty: number
): { x: number; y: number } {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  const safeRx = Math.max(rx, 1e-6);
  const safeRy = Math.max(ry, 1e-6);
  const scale = 1 / Math.sqrt((dx * dx) / (safeRx * safeRx) + (dy * dy) / (safeRy * safeRy));

  return { x: cx + dx * scale, y: cy + dy * scale };
}

/** Find where a ray from this shape's center toward target intersects the shape edge. */
export function shapeEdgeIntersection(
  shape: Shape,
  tx: number,
  ty: number
): { x: number; y: number } {
  if (shape.type === "circle") {
    return ellipseEdgeIntersection(shape.x, shape.y, shape.radiusX, shape.radiusY, tx, ty);
  }

  const bounds = getShapeBounds(shape);
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  return edgeIntersection(bounds, cx, cy, tx, ty);
}

/** Point-in-shape hit test used for connector endpoint attachment. */
export function shapeContainsPoint(shape: Shape, x: number, y: number): boolean {
  if (shape.type === "circle") {
    const rx = Math.max(shape.radiusX, 1e-6);
    const ry = Math.max(shape.radiusY, 1e-6);
    const nx = (x - shape.x) / rx;
    const ny = (y - shape.y) / ry;
    return nx * nx + ny * ny <= 1;
  }

  const b = getShapeBounds(shape);
  return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
}

/** Build a deterministic pair key for an unordered {a, b} pair. */
export function connectorPairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Compute the [x1,y1, x2,y2] line points for a connector, resolving endpoints.
 *  Optional maps for O(1) lookups instead of O(N) scans. */
export function computeConnectorPoints(
  connector: ConnectorShape,
  allShapes: Shape[],
  shapesById?: Map<string, Shape>,
  siblingMap?: Map<string, ConnectorShape[]>
): number[] {
  const fromShape = connector.fromId
    ? (shapesById?.get(connector.fromId) ??
      allShapes.find((s) => s.id === connector.fromId) ??
      null)
    : null;
  const toShape = connector.toId
    ? (shapesById?.get(connector.toId) ?? allShapes.find((s) => s.id === connector.toId) ?? null)
    : null;

  let fromCx: number, fromCy: number;
  if (fromShape) {
    const fromBounds = getShapeBounds(fromShape);
    fromCx = fromBounds.x + fromBounds.width / 2;
    fromCy = fromBounds.y + fromBounds.height / 2;
  } else if (connector.fromPoint) {
    fromCx = connector.fromPoint.x + connector.x;
    fromCy = connector.fromPoint.y + connector.y;
  } else {
    return [0, 0, 100, 0];
  }

  let toCx: number, toCy: number;
  if (toShape) {
    const toBounds = getShapeBounds(toShape);
    toCx = toBounds.x + toBounds.width / 2;
    toCy = toBounds.y + toBounds.height / 2;
  } else if (connector.toPoint) {
    toCx = connector.toPoint.x + connector.x;
    toCy = connector.toPoint.y + connector.y;
  } else {
    return [0, 0, 100, 0];
  }

  const startPt = fromShape
    ? shapeEdgeIntersection(fromShape, toCx, toCy)
    : { x: fromCx, y: fromCy };
  const endPt = toShape ? shapeEdgeIntersection(toShape, fromCx, fromCy) : { x: toCx, y: toCy };

  // Fan-out: offset connectors that share the same unordered {fromId, toId} pair
  if (connector.fromId && connector.toId) {
    const pk = connectorPairKey(connector.fromId, connector.toId);
    const siblings = siblingMap
      ? (siblingMap.get(pk) ?? [])
      : (allShapes.filter(
          (s) =>
            s.type === "connector" &&
            s.fromId &&
            s.toId &&
            connectorPairKey(s.fromId, s.toId) === pk
        ) as ConnectorShape[]);
    if (siblings.length > 1) {
      const idx = siblings.findIndex((s) => s.id === connector.id);
      const offset = (idx - (siblings.length - 1) / 2) * 20;
      const dx = endPt.x - startPt.x;
      const dy = endPt.y - startPt.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const px = -dy / len;
      const py = dx / len;
      startPt.x += px * offset;
      startPt.y += py * offset;
      endPt.x += px * offset;
      endPt.y += py * offset;
    }
  }

  return [startPt.x, startPt.y, endPt.x, endPt.y];
}
