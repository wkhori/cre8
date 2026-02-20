"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import type Konva from "konva";
import type { Shape } from "@/lib/types";
import { useCanvasStore } from "@/store/canvas-store";
import { useDebugStore } from "@/store/debug-store";
import { getShapeBounds } from "@/lib/shape-geometry";

interface DragSession {
  ids: string[];
  basePositions: Map<string, { x: number; y: number }>;
}

interface ViewportRef {
  scale: number;
  x: number;
  y: number;
}

export function computeDragPositions(
  basePositions: Map<string, { x: number; y: number }>,
  movedId: string,
  movedX: number,
  movedY: number
): Map<string, { x: number; y: number }> | null {
  const movedBase = basePositions.get(movedId);
  if (!movedBase) return null;

  const dx = movedX - movedBase.x;
  const dy = movedY - movedBase.y;
  const positions = new Map<string, { x: number; y: number }>();
  for (const [sid, base] of basePositions) {
    positions.set(sid, { x: base.x + dx, y: base.y + dy });
  }
  return positions;
}

export function useDragSession(
  stageRef: React.RefObject<Konva.Stage | null>,
  viewportRef: React.RefObject<ViewportRef>,
  throttledSetPointer: (p: {
    screenX: number;
    screenY: number;
    worldX: number;
    worldY: number;
  }) => void,
  onLiveDrag?: (shapes: Array<{ id: string; x: number; y: number }>) => void,
  onLiveDragEnd?: () => void,
  onLockShapes?: (ids: string[]) => void,
  onUnlockShapes?: () => void
) {
  const dragSessionRef = useRef<DragSession | null>(null);
  // RAF-batched drag positions: written to ref, flushed once per frame
  const dragPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const dragRafRef = useRef<number>(0);
  // Counter increments per RAF frame during drag to trigger connector re-render
  const [dragEpoch, setDragEpoch] = useState(0);
  // Ref to check if connectors exist (set by parent)
  const hasConnectorsRef = useRef(false);

  const setSelected = useCanvasStore((s) => s.setSelected);
  const updateShape = useCanvasStore((s) => s.updateShape);
  const updateShapes = useCanvasStore((s) => s.updateShapes);

  const handleDragStart = useCallback(
    (id: string) => {
      useDebugStore.getState().setInteraction("dragging");
      useCanvasStore.getState().pushHistory();

      const store = useCanvasStore.getState();
      const ids = store.selectedIds.includes(id) ? store.selectedIds : [id];
      if (!store.selectedIds.includes(id)) setSelected([id]);

      // Lock these shapes so inbound remote changes are deferred
      onLockShapes?.(ids);

      const shapeMap = new Map(store.shapes.map((s) => [s.id, s]));
      const basePositions = new Map<string, { x: number; y: number }>();
      const idSet = new Set(ids);

      // Recursively collect all descendants of dragged frames
      const collectChildren = (parentId: string) => {
        for (const child of store.shapes) {
          if (child.parentId === parentId && !idSet.has(child.id)) {
            idSet.add(child.id);
            if (child.type === "frame") collectChildren(child.id);
          }
        }
      };
      for (const sid of ids) {
        const s = shapeMap.get(sid);
        if (s?.type === "frame") collectChildren(sid);
      }

      const allIds = Array.from(idSet);
      for (const sid of allIds) {
        const s = shapeMap.get(sid);
        if (s) basePositions.set(sid, { x: s.x, y: s.y });
      }

      dragSessionRef.current = {
        ids: allIds,
        basePositions,
      };
    },
    [setSelected, onLockShapes]
  );

  const handleDragMove = useCallback(
    (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const stage = stageRef.current;
      const session = dragSessionRef.current;
      if (!stage || !session) return;

      // Update cursor position during drag
      const pos = stage.getPointerPosition();
      if (pos) {
        const vp = viewportRef.current;
        throttledSetPointer({
          screenX: pos.x,
          screenY: pos.y,
          worldX: (pos.x - vp.x) / vp.scale,
          worldY: (pos.y - vp.y) / vp.scale,
        });
      }

      // Compute all positions from anchor delta (no stage.findOne calls)
      const nextPositions = computeDragPositions(session.basePositions, id, node.x(), node.y());
      if (!nextPositions) return;

      // Reuse existing Map to reduce GC pressure
      const positions = dragPositionsRef.current;
      positions.clear();
      for (const [sid, next] of nextPositions) {
        positions.set(sid, next);
        // Physically move sibling/child Konva nodes so they track during drag
        if (sid !== id) {
          const sibling = stage.findOne(`#${sid}`);
          if (sibling) {
            sibling.position(next);
          }
        }
      }

      // Schedule single RAF flush — only bump epoch when connectors need tracking
      if (!dragRafRef.current) {
        dragRafRef.current = requestAnimationFrame(() => {
          dragRafRef.current = 0;
          if (hasConnectorsRef.current) {
            setDragEpoch((e) => e + 1);
          }
        });
      }

      // Broadcast positions via RTDB for remote users
      if (!onLiveDrag) return;
      const broadcast: Array<{ id: string; x: number; y: number }> = [];
      for (const [sid, p] of positions) {
        broadcast.push({ id: sid, x: p.x, y: p.y });
      }
      onLiveDrag(broadcast);
    },
    [stageRef, viewportRef, onLiveDrag, throttledSetPointer]
  );

  const handleDragEnd = useCallback(
    (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
      const session = dragSessionRef.current;
      if (!session) return;

      const node = e.target;
      const nextPositions = computeDragPositions(session.basePositions, id, node.x(), node.y());
      const updates: Array<{ id: string; patch: Partial<Shape> }> = [];
      if (nextPositions) {
        const shapeById = new Map(
          useCanvasStore.getState().shapes.map((shape) => [shape.id, shape])
        );
        for (const sid of session.ids) {
          const shape = shapeById.get(sid);
          const nextPos = nextPositions.get(sid);
          if (!shape || !nextPos) continue;

          if (shape.type === "connector") {
            // Connector points are derived from attached endpoints. Only persist translation
            // for connectors with at least one free endpoint (fromPoint/toPoint).
            const hasFreeEndpoint = !shape.fromId || !shape.toId;
            if (!hasFreeEndpoint) continue;
          }

          if (shape.x !== nextPos.x || shape.y !== nextPos.y) {
            updates.push({ id: sid, patch: { x: nextPos.x, y: nextPos.y } });
          }
        }
      }

      if (updates.length <= 1 && updates.length > 0) {
        updateShape(updates[0].id, updates[0].patch);
      } else if (updates.length > 1) {
        updateShapes(updates);
      }

      // ── Re-parent shapes after drag ──────────────────────────────────
      // After positions are committed, check if shapes moved into/out of frames
      const freshShapes = useCanvasStore.getState().shapes;
      const draggedIds = new Set(session.ids);
      const parentUpdates: Array<{ id: string; patch: Partial<Shape> }> = [];

      // Build frame list for containment checks
      const frames = freshShapes.filter((s) => s.type === "frame");

      for (const shape of freshShapes) {
        if (shape.type === "connector") continue;

        const wasDragged = draggedIds.has(shape.id);
        const parentWasDragged = shape.parentId ? draggedIds.has(shape.parentId) : false;

        // Only re-evaluate shapes that were part of this drag or whose parent was dragged
        if (!wasDragged && !parentWasDragged) continue;

        const bounds = getShapeBounds(shape);
        let newParentId: string | undefined;

        // Find the smallest frame that fully contains this shape
        for (const frame of frames) {
          if (frame.id === shape.id) continue;
          // Prevent circular: don't parent a frame to one of its own children
          if (shape.type === "frame" && frame.parentId === shape.id) continue;
          const fx = frame.x,
            fy = frame.y;
          const fr = fx + frame.w,
            fb = fy + frame.h;
          const inside =
            bounds.x >= fx &&
            bounds.y >= fy &&
            bounds.x + bounds.width <= fr &&
            bounds.y + bounds.height <= fb;
          if (inside) {
            // Prefer smallest containing frame (most specific parent)
            if (!newParentId) {
              newParentId = frame.id;
            } else {
              const prev = frames.find((f) => f.id === newParentId);
              if (prev && prev.type === "frame" && frame.w * frame.h < prev.w * prev.h) {
                newParentId = frame.id;
              }
            }
          }
        }

        if (shape.parentId !== newParentId) {
          parentUpdates.push({ id: shape.id, patch: { parentId: newParentId } });
        }
      }

      if (parentUpdates.length > 0) updateShapes(parentUpdates);

      // Clean up drag session
      dragSessionRef.current = null;
      dragPositionsRef.current.clear();
      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = 0;
      }
      if (hasConnectorsRef.current) {
        setDragEpoch((e) => e + 1);
      }
      useDebugStore.getState().setInteraction("idle");

      onLiveDragEnd?.();
      onUnlockShapes?.();
    },
    [updateShape, updateShapes, onLiveDragEnd, onUnlockShapes]
  );

  useEffect(() => {
    const dragPositions = dragPositionsRef.current;
    return () => {
      if (!dragSessionRef.current) return;
      dragSessionRef.current = null;
      dragPositions.clear();
      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = 0;
      }
      onLiveDragEnd?.();
      onUnlockShapes?.();
      useDebugStore.getState().setInteraction("idle");
    };
  }, [onLiveDragEnd, onUnlockShapes]);

  return {
    dragEpoch,
    dragPositionsRef,
    hasConnectorsRef,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  };
}
