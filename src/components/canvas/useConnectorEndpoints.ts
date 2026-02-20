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

      // Hit-test: find the shape under the drop point (excluding connectors)
      const hitShape = shapes.find((s) => {
        if (s.type === "connector" || s.id === connectorId) return false;
        return shapeContainsPoint(s, dropX, dropY);
      });

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
    },
    [shapes]
  );

  return {
    endpointDrag,
    setEndpointDrag,
    selectedConnectorEndpoints,
    handleEndpointDragEnd,
  };
}
