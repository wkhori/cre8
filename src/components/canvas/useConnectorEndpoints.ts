"use client";

import { useCallback, useMemo, useState } from "react";
import type Konva from "konva";
import type { Shape, ConnectorShape } from "@/lib/types";
import {
  getShapeBounds,
  shapeEdgeIntersection,
  shapeContainsPoint,
  shapePerimeterPoint,
  computePortAngle,
  computeConnectorPoints,
} from "@/lib/shape-geometry";
import { useCanvasStore } from "@/store/canvas-store";

export function useConnectorEndpoints(
  shapesById: Map<string, Shape>,
  selectedIds: string[],
  shapes: Shape[]
) {
  const [endpointDrag, setEndpointDrag] = useState<{
    connectorId: string;
    end: "from" | "to";
    x: number;
    y: number;
  } | null>(null);
  const [hoveredAttachShapeId, setHoveredAttachShapeId] = useState<string | null>(null);
  const [endpointDragEpoch, setEndpointDragEpoch] = useState(0);

  // Control point drag state (for curved/elbowed handles)
  const [controlPointDrag, setControlPointDrag] = useState<{
    connectorId: string;
    x: number;
    y: number;
  } | null>(null);

  const attachableShapes = useMemo(
    () =>
      [...shapes].filter((shape) => shape.type !== "connector").sort((a, b) => b.zIndex - a.zIndex),
    [shapes]
  );

  const findAttachableShapeAt = useCallback(
    (x: number, y: number, connectorId: string): Shape | null => {
      for (const shape of attachableShapes) {
        if (shape.id === connectorId) continue;
        if (shapeContainsPoint(shape, x, y)) return shape;
      }
      return null;
    },
    [attachableShapes]
  );

  // Compute draggable endpoint positions for selected connectors
  const selectedConnectorEndpoints = useMemo(() => {
    if (selectedIds.length === 0) return [];
    const result: Array<{
      connectorId: string;
      end: "from" | "to";
      x: number;
      y: number;
    }> = [];
    for (const id of selectedIds) {
      const shape = shapesById.get(id);
      if (!shape || shape.type !== "connector") continue;
      const c: ConnectorShape = shape;

      let fromCx: number | null = null,
        fromCy: number | null = null;
      let fromShape: Shape | null = null;
      if (c.fromId) {
        const fs = shapesById.get(c.fromId);
        if (fs) {
          const fromBounds = getShapeBounds(fs);
          fromCx = fromBounds.x + fromBounds.width / 2;
          fromCy = fromBounds.y + fromBounds.height / 2;
          fromShape = fs;
        }
      } else if (c.fromPoint) {
        fromCx = c.fromPoint.x + c.x;
        fromCy = c.fromPoint.y + c.y;
      }

      let toCx: number | null = null,
        toCy: number | null = null;
      let toShape: Shape | null = null;
      if (c.toId) {
        const ts = shapesById.get(c.toId);
        if (ts) {
          const toBounds = getShapeBounds(ts);
          toCx = toBounds.x + toBounds.width / 2;
          toCy = toBounds.y + toBounds.height / 2;
          toShape = ts;
        }
      } else if (c.toPoint) {
        toCx = c.toPoint.x + c.x;
        toCy = c.toPoint.y + c.y;
      }

      if (fromCx == null || fromCy == null || toCx == null || toCy == null) continue;

      // Use port angle if set, otherwise auto-aim at opposite center
      const fromPt =
        fromShape && c.fromPort != null
          ? shapePerimeterPoint(fromShape, c.fromPort)
          : fromShape
            ? shapeEdgeIntersection(fromShape, toCx, toCy)
            : { x: fromCx, y: fromCy };
      const toPt =
        toShape && c.toPort != null
          ? shapePerimeterPoint(toShape, c.toPort)
          : toShape
            ? shapeEdgeIntersection(toShape, fromCx, fromCy)
            : { x: toCx, y: toCy };

      result.push({ connectorId: id, end: "from", x: fromPt.x, y: fromPt.y });
      result.push({ connectorId: id, end: "to", x: toPt.x, y: toPt.y });
    }
    return result;
  }, [selectedIds, shapesById]);

  // Compute control point positions for curved/elbowed connectors
  const selectedConnectorControlPoints = useMemo(() => {
    if (selectedIds.length === 0) return [];
    const result: Array<{
      connectorId: string;
      index: number;
      x: number;
      y: number;
    }> = [];

    for (const id of selectedIds) {
      const shape = shapesById.get(id);
      if (!shape || shape.type !== "connector") continue;
      const c = shape as ConnectorShape;
      const routing = c.routingMode ?? "straight";
      if (routing === "straight") continue;

      const pts = computeConnectorPoints(c, shapes, shapesById);

      if (routing === "curved" && pts.length === 6) {
        result.push({ connectorId: id, index: 0, x: pts[2], y: pts[3] });
      } else if (routing === "elbowed" && pts.length === 8) {
        // Single handle at the bend midpoint (average of the two corner points)
        const mx = (pts[2] + pts[4]) / 2;
        const my = (pts[3] + pts[5]) / 2;
        result.push({ connectorId: id, index: 0, x: mx, y: my });
      }
    }
    return result;
  }, [selectedIds, shapesById, shapes]);

  const handleEndpointDragMove = useCallback(
    (connectorId: string, end: "from" | "to", e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const x = node.x();
      const y = node.y();
      setEndpointDrag({ connectorId, end, x, y });
      const hitShape = findAttachableShapeAt(x, y, connectorId);
      setHoveredAttachShapeId(hitShape?.id ?? null);
    },
    [findAttachableShapeAt]
  );

  const handleEndpointDragEnd = useCallback(
    (connectorId: string, end: "from" | "to", e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const dropX = node.x();
      const dropY = node.y();
      const connector = shapes.find(
        (shape): shape is ConnectorShape => shape.id === connectorId && shape.type === "connector"
      );
      const connectorX = connector?.x ?? 0;
      const connectorY = connector?.y ?? 0;

      const hitShape = findAttachableShapeAt(dropX, dropY, connectorId);

      const store = useCanvasStore.getState();
      store.pushHistory();

      if (hitShape) {
        // Compute port angle from the drop position relative to the shape
        const port = computePortAngle(hitShape, dropX, dropY);
        if (end === "from") {
          store.updateShape(connectorId, {
            fromId: hitShape.id,
            fromPoint: null,
            fromPort: port,
          } as Partial<Shape>);
        } else {
          store.updateShape(connectorId, {
            toId: hitShape.id,
            toPoint: null,
            toPort: port,
          } as Partial<Shape>);
        }
      } else {
        if (end === "from") {
          store.updateShape(connectorId, {
            fromId: null,
            fromPoint: { x: dropX - connectorX, y: dropY - connectorY },
            fromPort: null,
          } as Partial<Shape>);
        } else {
          store.updateShape(connectorId, {
            toId: null,
            toPoint: { x: dropX - connectorX, y: dropY - connectorY },
            toPort: null,
          } as Partial<Shape>);
        }
      }

      setEndpointDrag(null);
      setHoveredAttachShapeId(null);
      setEndpointDragEpoch((e) => e + 1);
    },
    [shapes, findAttachableShapeAt]
  );

  // ── Control point drag handlers ──────────────────────────────────

  const handleControlPointDragMove = useCallback(
    (_connectorId: string, _index: number, e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      setControlPointDrag({ connectorId: _connectorId, x: node.x(), y: node.y() });
    },
    []
  );

  const handleControlPointDragEnd = useCallback(
    (connectorId: string, _index: number, e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const dropX = node.x();
      const dropY = node.y();

      const connector = shapes.find(
        (s): s is ConnectorShape => s.id === connectorId && s.type === "connector"
      );
      if (!connector) {
        setControlPointDrag(null);
        return;
      }

      const store = useCanvasStore.getState();
      store.pushHistory();

      const routing = connector.routingMode ?? "straight";

      if (routing === "curved") {
        // Compute curveOffset from the drag position
        const pts = computeConnectorPoints(connector, shapes, shapesById);
        if (pts.length >= 6) {
          const sx = pts[0],
            sy = pts[1];
          const ex = pts[pts.length - 2],
            ey = pts[pts.length - 1];
          const midX = (sx + ex) / 2;
          const midY = (sy + ey) / 2;
          const dx = ex - sx;
          const dy = ey - sy;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const px = -dy / len;
          const py = dx / len;
          const offset = (dropX - midX) * px + (dropY - midY) * py;
          store.updateShape(connectorId, { curveOffset: offset } as Partial<Shape>);
        }
      } else if (routing === "elbowed") {
        // Compute elbowMidRatio from the drag position
        const pts = computeConnectorPoints(
          { ...connector, elbowMidRatio: undefined } as ConnectorShape,
          shapes,
          shapesById
        );
        if (pts.length >= 8) {
          const sx = pts[0],
            sy = pts[1];
          const ex = pts[pts.length - 2],
            ey = pts[pts.length - 1];
          const dx = ex - sx;
          const dy = ey - sy;
          let ratio = 0.5;
          if (Math.abs(dy) > Math.abs(dx)) {
            ratio = dy !== 0 ? (dropY - sy) / dy : 0.5;
          } else {
            ratio = dx !== 0 ? (dropX - sx) / dx : 0.5;
          }
          store.updateShape(connectorId, {
            elbowMidRatio: Math.max(0.1, Math.min(0.9, ratio)),
          } as Partial<Shape>);
        }
      }

      setControlPointDrag(null);
      setEndpointDragEpoch((e) => e + 1);
    },
    [shapes, shapesById]
  );

  return {
    endpointDrag,
    setEndpointDrag,
    hoveredAttachShapeId,
    selectedConnectorEndpoints,
    handleEndpointDragMove,
    handleEndpointDragEnd,
    endpointDragEpoch,
    controlPointDrag,
    selectedConnectorControlPoints,
    handleControlPointDragMove,
    handleControlPointDragEnd,
  };
}
