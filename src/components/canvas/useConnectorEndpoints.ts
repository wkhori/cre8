"use client";

import { useCallback, useMemo, useState } from "react";
import type Konva from "konva";
import type { Shape, ConnectorShape } from "@/lib/types";
import { getShapeBounds, shapeEdgeIntersection, shapeContainsPoint } from "@/lib/shape-geometry";
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

      const fromPt = fromShape
        ? shapeEdgeIntersection(fromShape, toCx, toCy)
        : { x: fromCx, y: fromCy };
      const toPt = toShape ? shapeEdgeIntersection(toShape, fromCx, fromCy) : { x: toCx, y: toCy };

      result.push({ connectorId: id, end: "from", x: fromPt.x, y: fromPt.y });
      result.push({ connectorId: id, end: "to", x: toPt.x, y: toPt.y });
    }
    return result;
  }, [selectedIds, shapesById]);

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
        if (end === "from") {
          store.updateShape(connectorId, {
            fromId: hitShape.id,
            fromPoint: null,
          } as Partial<Shape>);
        } else {
          store.updateShape(connectorId, { toId: hitShape.id, toPoint: null } as Partial<Shape>);
        }
      } else {
        if (end === "from") {
          store.updateShape(connectorId, {
            fromId: null,
            fromPoint: { x: dropX - connectorX, y: dropY - connectorY },
          } as Partial<Shape>);
        } else {
          store.updateShape(connectorId, {
            toId: null,
            toPoint: { x: dropX - connectorX, y: dropY - connectorY },
          } as Partial<Shape>);
        }
      }

      setEndpointDrag(null);
      setHoveredAttachShapeId(null);
    },
    [shapes, findAttachableShapeAt]
  );

  return {
    endpointDrag,
    setEndpointDrag,
    hoveredAttachShapeId,
    selectedConnectorEndpoints,
    handleEndpointDragMove,
    handleEndpointDragEnd,
  };
}
