"use client";

import { useCallback, useMemo, useState } from "react";
import type Konva from "konva";
import type { Shape, ConnectorShape } from "@/lib/types";
import { getShapeBounds, edgeIntersection, type Bounds } from "@/lib/shape-geometry";
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
      const c = shape as ConnectorShape;

      let fromCx: number | null = null,
        fromCy: number | null = null,
        fromBounds: Bounds | null = null;
      if (c.fromId) {
        const fs = shapesById.get(c.fromId);
        if (fs) {
          fromBounds = getShapeBounds(fs);
          fromCx = fromBounds.x + fromBounds.width / 2;
          fromCy = fromBounds.y + fromBounds.height / 2;
        }
      } else if (c.fromPoint) {
        fromCx = c.fromPoint.x;
        fromCy = c.fromPoint.y;
      }

      let toCx: number | null = null,
        toCy: number | null = null,
        toBounds: Bounds | null = null;
      if (c.toId) {
        const ts = shapesById.get(c.toId);
        if (ts) {
          toBounds = getShapeBounds(ts);
          toCx = toBounds.x + toBounds.width / 2;
          toCy = toBounds.y + toBounds.height / 2;
        }
      } else if (c.toPoint) {
        toCx = c.toPoint.x;
        toCy = c.toPoint.y;
      }

      if (fromCx == null || fromCy == null || toCx == null || toCy == null) continue;

      const fromPt = fromBounds
        ? edgeIntersection(fromBounds, fromCx, fromCy, toCx, toCy)
        : { x: fromCx, y: fromCy };
      const toPt = toBounds
        ? edgeIntersection(toBounds, toCx, toCy, fromCx, fromCy)
        : { x: toCx, y: toCy };

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

      // Hit-test: find the shape under the drop point (excluding connectors)
      const hitShape = shapes.find((s) => {
        if (s.type === "connector" || s.id === connectorId) return false;
        const b = getShapeBounds(s);
        return dropX >= b.x && dropX <= b.x + b.width && dropY >= b.y && dropY <= b.y + b.height;
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
            fromPoint: { x: dropX, y: dropY },
          } as Partial<Shape>);
        } else {
          store.updateShape(connectorId, {
            toId: null,
            toPoint: { x: dropX, y: dropY },
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
