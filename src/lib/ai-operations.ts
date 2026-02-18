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

/**
 * Execute a batch of AI operations against the canvas store.
 * Pushes history once so the entire batch is a single undo step.
 * All shapes are collected and applied in ONE setShapes call to avoid
 * triggering N subscription firings → N Firestore writes → sync loop.
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

  // Collect all new shapes and mutations, then apply once
  const newShapes: Shape[] = [];
  const updates: Array<{ id: string; patch: Partial<Shape> }> = [];
  const deletions: string[] = [];
  let baseZIndex = store.shapes.length === 0
    ? 0
    : Math.max(...store.shapes.map((s) => s.zIndex)) + 1;

  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  for (const op of operations) {
    switch (op.type) {
      case "createStickyNote": {
        const id = generateId();
        tempIdMap.set(op.tempId, id);
        newShapes.push({
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
          zIndex: baseZIndex++,
        } as StickyNoteShape);
        break;
      }

      case "createFrame": {
        const id = generateId();
        tempIdMap.set(op.tempId, id);
        newShapes.push({
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
        } as FrameShape);
        break;
      }

      case "createShape": {
        const id = generateId();
        tempIdMap.set(op.tempId, id);

        if (op.shapeType === "circle") {
          newShapes.push({
            id,
            type: "circle",
            x: op.x + op.w / 2,
            y: op.y + op.h / 2,
            radiusX: op.w / 2,
            radiusY: op.h / 2,
            fill: op.fill ?? "#3b82f6",
            rotation: 0,
            opacity: 1,
            zIndex: baseZIndex++,
          } as CircleShape);
        } else {
          newShapes.push({
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
            zIndex: baseZIndex++,
          } as RectShape);
        }
        break;
      }

      case "createText": {
        const id = generateId();
        tempIdMap.set(op.tempId, id);
        const fontSize = op.fontSize ?? 24;
        const estimatedWidth = op.width ?? Math.min(
          800,
          Math.max(100, Math.ceil(op.text.length * fontSize * 0.6) + 20),
        );
        newShapes.push({
          id,
          type: "text",
          x: op.x,
          y: op.y,
          text: op.text,
          fontSize,
          fontFamily: "sans-serif",
          fill: op.fill ?? (isDark ? "#fafafa" : "#18181b"),
          width: estimatedWidth,
          align: "left",
          rotation: 0,
          opacity: 1,
          zIndex: baseZIndex++,
        } as TextShape);
        break;
      }

      case "createConnector": {
        const id = generateId();
        tempIdMap.set(op.tempId, id);
        const fromId = tempIdMap.get(op.fromId) ?? op.fromId;
        const toId = tempIdMap.get(op.toId) ?? op.toId;
        newShapes.push({
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
          zIndex: baseZIndex++,
        } as ConnectorShape);
        break;
      }

      case "moveObject": {
        const realId = tempIdMap.get(op.objectId) ?? op.objectId;
        updates.push({ id: realId, patch: { x: op.x, y: op.y } });
        break;
      }

      case "resizeObject": {
        const realId = tempIdMap.get(op.objectId) ?? op.objectId;
        const shape = store.shapes.find((s) => s.id === realId);
        if (!shape) break;
        if (shape.type === "circle") {
          updates.push({ id: realId, patch: { radiusX: op.w / 2, radiusY: op.h / 2 } });
        } else {
          updates.push({ id: realId, patch: { w: op.w, h: op.h } });
        }
        break;
      }

      case "updateText": {
        const realId = tempIdMap.get(op.objectId) ?? op.objectId;
        const shape = store.shapes.find((s) => s.id === realId);
        if (!shape) break;
        if (shape.type === "frame") {
          updates.push({ id: realId, patch: { title: op.newText } });
        } else {
          updates.push({ id: realId, patch: { text: op.newText } });
        }
        break;
      }

      case "changeColor": {
        const realId = tempIdMap.get(op.objectId) ?? op.objectId;
        const shape = store.shapes.find((s) => s.id === realId);
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
        updates.push({ id: realId, patch });
        break;
      }

      case "deleteObject": {
        const realId = tempIdMap.get(op.objectId) ?? op.objectId;
        deletions.push(realId);
        break;
      }
    }
  }

  // Apply everything in a SINGLE store update
  let finalShapes = [...store.shapes];

  // Add new shapes
  if (newShapes.length > 0) {
    finalShapes = [...finalShapes, ...newShapes];
  }

  // Apply updates
  if (updates.length > 0) {
    const updateMap = new Map(updates.map((u) => [u.id, u.patch]));
    finalShapes = finalShapes.map((s) => {
      const patch = updateMap.get(s.id);
      return patch ? ({ ...s, ...patch } as Shape) : s;
    });
  }

  // Apply deletions
  if (deletions.length > 0) {
    const deleteSet = new Set(deletions);
    finalShapes = finalShapes.filter((s) => !deleteSet.has(s.id));
  }

  // One store update → one subscription fire → one Firestore sync
  store.setShapes(finalShapes);

  return tempIdMap;
}
