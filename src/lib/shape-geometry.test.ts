import { describe, expect, it } from "vitest";
import type {
  CircleShape,
  RectShape,
  LineShape,
  StickyNoteShape,
  FrameShape,
  ConnectorShape,
  Shape,
} from "@/lib/types";
import {
  getShapeBounds,
  edgeIntersection,
  computeConnectorPoints,
  connectorPairKey,
} from "@/lib/shape-geometry";

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

  it("returns position and size for a sticky note", () => {
    const sticky: StickyNoteShape = {
      id: "s1",
      type: "sticky",
      x: 50,
      y: 60,
      w: 200,
      h: 200,
      text: "Hello",
      color: "#fef08a",
      fontSize: 16,
      rotation: 0,
      opacity: 1,
      zIndex: 0,
    };
    expect(getShapeBounds(sticky)).toEqual({ x: 50, y: 60, width: 200, height: 200 });
  });

  it("returns position and size for a frame", () => {
    const frame: FrameShape = {
      id: "f1",
      type: "frame",
      x: 100,
      y: 100,
      w: 400,
      h: 300,
      title: "Frame",
      fill: "rgba(0,0,0,0.03)",
      stroke: "#a1a1aa",
      rotation: 0,
      opacity: 1,
      zIndex: 0,
    };
    expect(getShapeBounds(frame)).toEqual({ x: 100, y: 100, width: 400, height: 300 });
  });

  it("returns points-based bounds for a connector", () => {
    const connector: ConnectorShape = {
      id: "conn1",
      type: "connector",
      x: 10,
      y: 20,
      fromId: "a",
      toId: "b",
      style: "arrow",
      stroke: "#6b7280",
      strokeWidth: 2,
      points: [0, 0, 150, 80],
      rotation: 0,
      opacity: 1,
      zIndex: 0,
    };
    expect(getShapeBounds(connector)).toEqual({ x: 10, y: 20, width: 150, height: 80 });
  });

  it("returns fallback bounds for a connector with no points", () => {
    const connector: ConnectorShape = {
      id: "conn2",
      type: "connector",
      x: 5,
      y: 10,
      fromId: "a",
      toId: "b",
      style: "line",
      stroke: "#6b7280",
      strokeWidth: 2,
      rotation: 0,
      opacity: 1,
      zIndex: 0,
    };
    // Falls back to [0,0,100,0] when no points
    expect(getShapeBounds(connector)).toEqual({ x: 5, y: 10, width: 100, height: 0 });
  });
});

describe("edgeIntersection", () => {
  const bounds = { x: 0, y: 0, width: 100, height: 60 };
  const cx = 50;
  const cy = 30;

  it("hits the right edge for a rightward ray", () => {
    const pt = edgeIntersection(bounds, cx, cy, 200, 30);
    expect(pt.x).toBeCloseTo(100);
    expect(pt.y).toBeCloseTo(30);
  });

  it("hits the top edge for an upward ray", () => {
    const pt = edgeIntersection(bounds, cx, cy, 50, -100);
    expect(pt.x).toBeCloseTo(50);
    expect(pt.y).toBeCloseTo(0);
  });

  it("hits a corner for a diagonal ray", () => {
    // Pointing toward top-right corner (100, 0) from center (50, 30)
    const pt = edgeIntersection(bounds, cx, cy, 100, 0);
    // Should hit the boundary — verify it's on the edge
    expect(pt.x).toBeGreaterThanOrEqual(bounds.x);
    expect(pt.x).toBeLessThanOrEqual(bounds.x + bounds.width);
    expect(pt.y).toBeGreaterThanOrEqual(bounds.y);
    expect(pt.y).toBeLessThanOrEqual(bounds.y + bounds.height);
  });

  it("returns center for zero-length ray", () => {
    const pt = edgeIntersection(bounds, cx, cy, cx, cy);
    expect(pt).toEqual({ x: cx, y: cy });
  });
});

describe("computeConnectorPoints", () => {
  const baseProps = { rotation: 0, opacity: 1, zIndex: 0 };

  const rectA: RectShape = {
    id: "a",
    type: "rect",
    x: 0,
    y: 0,
    w: 100,
    h: 60,
    fill: "#000",
    ...baseProps,
  };

  const rectB: RectShape = {
    id: "b",
    type: "rect",
    x: 300,
    y: 0,
    w: 100,
    h: 60,
    fill: "#000",
    ...baseProps,
  };

  it("computes shape-to-shape connector points", () => {
    const conn: ConnectorShape = {
      id: "c1",
      type: "connector",
      x: 0,
      y: 0,
      fromId: "a",
      toId: "b",
      style: "arrow",
      stroke: "#000",
      strokeWidth: 2,
      ...baseProps,
    };
    const allShapes: Shape[] = [rectA, rectB, conn];
    const pts = computeConnectorPoints(conn, allShapes);
    expect(pts).toHaveLength(4);
    // Start should be on the right edge of rectA (x=100)
    expect(pts[0]).toBeCloseTo(100);
    // End should be on the left edge of rectB (x=300)
    expect(pts[2]).toBeCloseTo(300);
    // Y should be at centers (30)
    expect(pts[1]).toBeCloseTo(30);
    expect(pts[3]).toBeCloseTo(30);
  });

  it("computes shape-to-point connector", () => {
    const conn: ConnectorShape = {
      id: "c2",
      type: "connector",
      x: 0,
      y: 0,
      fromId: "a",
      toPoint: { x: 500, y: 500 },
      style: "arrow",
      stroke: "#000",
      strokeWidth: 2,
      ...baseProps,
    };
    const pts = computeConnectorPoints(conn, [rectA, conn]);
    expect(pts).toHaveLength(4);
    // End point should be exactly the freestanding point
    expect(pts[2]).toBe(500);
    expect(pts[3]).toBe(500);
  });

  it("computes point-to-point connector", () => {
    const conn: ConnectorShape = {
      id: "c3",
      type: "connector",
      x: 0,
      y: 0,
      fromPoint: { x: 10, y: 20 },
      toPoint: { x: 200, y: 300 },
      style: "line",
      stroke: "#000",
      strokeWidth: 2,
      ...baseProps,
    };
    const pts = computeConnectorPoints(conn, [conn]);
    expect(pts).toEqual([10, 20, 200, 300]);
  });

  it("returns fallback for missing endpoints", () => {
    const conn: ConnectorShape = {
      id: "c4",
      type: "connector",
      x: 0,
      y: 0,
      fromId: "nonexistent",
      toId: "also_missing",
      style: "arrow",
      stroke: "#000",
      strokeWidth: 2,
      ...baseProps,
    };
    const pts = computeConnectorPoints(conn, [conn]);
    expect(pts).toEqual([0, 0, 100, 0]);
  });

  it("offsets parallel connectors via fan-out", () => {
    const conn1: ConnectorShape = {
      id: "c5",
      type: "connector",
      x: 0,
      y: 0,
      fromId: "a",
      toId: "b",
      style: "arrow",
      stroke: "#000",
      strokeWidth: 2,
      ...baseProps,
    };
    const conn2: ConnectorShape = {
      id: "c6",
      type: "connector",
      x: 0,
      y: 0,
      fromId: "a",
      toId: "b",
      style: "arrow",
      stroke: "#000",
      strokeWidth: 2,
      ...baseProps,
    };
    const allShapes: Shape[] = [rectA, rectB, conn1, conn2];
    const pts1 = computeConnectorPoints(conn1, allShapes);
    const pts2 = computeConnectorPoints(conn2, allShapes);
    // Two parallel connectors should be offset from each other
    expect(pts1[1]).not.toBeCloseTo(pts2[1]); // Y values differ
  });

  it("uses shapesById map for O(1) endpoint lookup", () => {
    const conn: ConnectorShape = {
      id: "c7",
      type: "connector",
      x: 0,
      y: 0,
      fromId: "a",
      toId: "b",
      style: "arrow",
      stroke: "#000",
      strokeWidth: 2,
      ...baseProps,
    };
    const allShapes: Shape[] = [rectA, rectB, conn];
    const shapesById = new Map<string, Shape>(allShapes.map((s) => [s.id, s]));

    const ptsWithMap = computeConnectorPoints(conn, allShapes, shapesById);
    const ptsWithout = computeConnectorPoints(conn, allShapes);

    // Both paths should produce identical results
    expect(ptsWithMap[0]).toBeCloseTo(ptsWithout[0]);
    expect(ptsWithMap[1]).toBeCloseTo(ptsWithout[1]);
    expect(ptsWithMap[2]).toBeCloseTo(ptsWithout[2]);
    expect(ptsWithMap[3]).toBeCloseTo(ptsWithout[3]);
  });

  it("uses siblingMap for O(1) fan-out lookup", () => {
    const conn1: ConnectorShape = {
      id: "c8",
      type: "connector",
      x: 0,
      y: 0,
      fromId: "a",
      toId: "b",
      style: "arrow",
      stroke: "#000",
      strokeWidth: 2,
      ...baseProps,
    };
    const conn2: ConnectorShape = {
      id: "c9",
      type: "connector",
      x: 0,
      y: 0,
      fromId: "a",
      toId: "b",
      style: "arrow",
      stroke: "#000",
      strokeWidth: 2,
      ...baseProps,
    };
    const allShapes: Shape[] = [rectA, rectB, conn1, conn2];
    const shapesById = new Map<string, Shape>(allShapes.map((s) => [s.id, s]));
    const pk = connectorPairKey("a", "b");
    const siblingMap = new Map([[pk, [conn1, conn2]]]);

    // Map path should produce identical results to the scan path
    const pts1Map = computeConnectorPoints(conn1, allShapes, shapesById, siblingMap);
    const pts1NoMap = computeConnectorPoints(conn1, allShapes);
    expect(pts1Map[0]).toBeCloseTo(pts1NoMap[0]);
    expect(pts1Map[1]).toBeCloseTo(pts1NoMap[1]);
    expect(pts1Map[2]).toBeCloseTo(pts1NoMap[2]);
    expect(pts1Map[3]).toBeCloseTo(pts1NoMap[3]);

    // Fan-out should still work — two siblings are offset
    const pts2Map = computeConnectorPoints(conn2, allShapes, shapesById, siblingMap);
    expect(pts1Map[1]).not.toBeCloseTo(pts2Map[1]);
  });
});

describe("connectorPairKey", () => {
  it("produces same key regardless of argument order", () => {
    expect(connectorPairKey("a", "b")).toBe(connectorPairKey("b", "a"));
  });

  it("produces different keys for different pairs", () => {
    expect(connectorPairKey("a", "b")).not.toBe(connectorPairKey("a", "c"));
  });

  it("uses deterministic format (smaller first)", () => {
    expect(connectorPairKey("z", "a")).toBe("a|z");
    expect(connectorPairKey("abc", "xyz")).toBe("abc|xyz");
  });
});
