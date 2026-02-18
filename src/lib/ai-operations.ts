"use client";

import { useCanvasStore } from "@/store/canvas-store";
import { generateId } from "@/lib/id";
import type {
  Shape,
  RectShape,
  CircleShape,
  TextShape,
  StickyNoteShape,
  FrameShape,
  ConnectorShape,
} from "@/lib/types";
import type { AIOperation } from "@/lib/ai-tools";

function nextZIndex(shapes: Shape[]): number {
  if (shapes.length === 0) return 0;
  return Math.max(...shapes.map((s) => s.zIndex)) + 1;
}

/**
 * Execute a batch of AI operations against the canvas store.
 * Pushes history once so the entire batch is a single undo step.
 * Returns a map of temp IDs → real IDs for reference.
 *
 * All coordinates are TOP-LEFT — no center conversion needed.
 */
export function executeAIOperations(
  operations: AIOperation[],
): Map<string, string> {
  const store = useCanvasStore.getState();
  const tempIdMap = new Map<string, string>();

  // Snapshot current state for undo (one undo step for the whole batch)
  store.pushHistory();

  for (const op of operations) {
    // Re-read state each iteration since shapes array grows
    const currentShapes = useCanvasStore.getState().shapes;

    switch (op.type) {
      case "createStickyNote": {
        const id = generateId();
        tempIdMap.set(op.tempId, id);
        const shape: StickyNoteShape = {
          id,
          type: "sticky",
          x: op.x,
          y: op.y,
          w: op.w ?? 260,
          h: op.h ?? 120,
          text: op.text,
          color: op.color ?? "#fef08a",
          fontSize: 16,
          rotation: 0,
          opacity: 1,
          zIndex: nextZIndex(currentShapes),
        };
        store.addShape(shape);
        break;
      }

      case "createFrame": {
        const id = generateId();
        tempIdMap.set(op.tempId, id);
        const shape: FrameShape = {
          id,
          type: "frame",
          x: op.x,
          y: op.y,
          w: op.w ?? 400,
          h: op.h ?? 300,
          title: op.title,
          fill: "rgba(0,0,0,0.03)",
          stroke: "#a1a1aa",
          rotation: 0,
          opacity: 1,
          zIndex: 0, // frames behind everything
        };
        store.addShape(shape);
        break;
      }

      case "createShape": {
        const id = generateId();
        tempIdMap.set(op.tempId, id);

        if (op.shapeType === "circle") {
          // For circles, x/y is center position (Konva convention)
          const shape: CircleShape = {
            id,
            type: "circle",
            x: op.x + op.w / 2,
            y: op.y + op.h / 2,
            radiusX: op.w / 2,
            radiusY: op.h / 2,
            fill: op.fill ?? "#3b82f6",
            rotation: 0,
            opacity: 1,
            zIndex: nextZIndex(currentShapes),
          };
          store.addShape(shape);
        } else {
          const shape: RectShape = {
            id,
            type: "rect",
            x: op.x,
            y: op.y,
            w: op.w,
            h: op.h,
            fill: op.fill ?? "#3b82f6",
            cornerRadius: 4,
            rotation: 0,
            opacity: 1,
            zIndex: nextZIndex(currentShapes),
          };
          store.addShape(shape);
        }
        break;
      }

      case "createText": {
        const id = generateId();
        tempIdMap.set(op.tempId, id);
        const isDark =
          typeof document !== "undefined" &&
          document.documentElement.classList.contains("dark");
        const shape: TextShape = {
          id,
          type: "text",
          x: op.x,
          y: op.y,
          text: op.text,
          fontSize: op.fontSize ?? 24,
          fontFamily: "sans-serif",
          fill: op.fill ?? (isDark ? "#fafafa" : "#18181b"),
          width: 200,
          align: "left",
          rotation: 0,
          opacity: 1,
          zIndex: nextZIndex(currentShapes),
        };
        store.addShape(shape);
        break;
      }

      case "createConnector": {
        const id = generateId();
        tempIdMap.set(op.tempId, id);
        // Resolve temp IDs to real IDs
        const fromId = tempIdMap.get(op.fromId) ?? op.fromId;
        const toId = tempIdMap.get(op.toId) ?? op.toId;
        const shape: ConnectorShape = {
          id,
          type: "connector",
          x: 0,
          y: 0,
          fromId,
          toId,
          style: op.style ?? "arrow",
          stroke: "#6b7280",
          strokeWidth: 2,
          rotation: 0,
          opacity: 1,
          zIndex: nextZIndex(currentShapes),
        };
        store.addShape(shape);
        break;
      }

      case "moveObject": {
        const realId = tempIdMap.get(op.objectId) ?? op.objectId;
        store.updateShapes([{ id: realId, patch: { x: op.x, y: op.y } }]);
        break;
      }

      case "resizeObject": {
        const realId = tempIdMap.get(op.objectId) ?? op.objectId;
        const shape = currentShapes.find((s) => s.id === realId);
        if (!shape) break;
        if (shape.type === "circle") {
          store.updateShapes([
            { id: realId, patch: { radiusX: op.w / 2, radiusY: op.h / 2 } },
          ]);
        } else {
          store.updateShapes([{ id: realId, patch: { w: op.w, h: op.h } }]);
        }
        break;
      }

      case "updateText": {
        const realId = tempIdMap.get(op.objectId) ?? op.objectId;
        const shape = currentShapes.find((s) => s.id === realId);
        if (!shape) break;
        if (shape.type === "frame") {
          store.updateShapes([{ id: realId, patch: { title: op.newText } }]);
        } else {
          store.updateShapes([{ id: realId, patch: { text: op.newText } }]);
        }
        break;
      }

      case "changeColor": {
        const realId = tempIdMap.get(op.objectId) ?? op.objectId;
        const shape = currentShapes.find((s) => s.id === realId);
        if (!shape) break;
        let patch: Partial<Shape>;
        switch (shape.type) {
          case "sticky":
            patch = { color: op.color } as Partial<Shape>;
            break;
          case "line":
          case "connector":
            patch = { stroke: op.color } as Partial<Shape>;
            break;
          default:
            patch = { fill: op.color } as Partial<Shape>;
            break;
        }
        store.updateShapes([{ id: realId, patch }]);
        break;
      }

      case "deleteObject": {
        const realId = tempIdMap.get(op.objectId) ?? op.objectId;
        store.removeShapeSync(realId);
        break;
      }
    }
  }

  return tempIdMap;
}
