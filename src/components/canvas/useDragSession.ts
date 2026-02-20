"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import type Konva from "konva";
import type { Shape } from "@/lib/types";
import { useCanvasStore } from "@/store/canvas-store";
import { useDebugStore } from "@/store/debug-store";

interface DragSession {
  anchorId: string;
  anchorStartX: number;
  anchorStartY: number;
  ids: string[];
  basePositions: Map<string, { x: number; y: number }>;
}

interface ViewportRef {
  scale: number;
  x: number;
  y: number;
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
      for (const sid of ids) {
        const s = shapeMap.get(sid);
        if (s) basePositions.set(sid, { x: s.x, y: s.y });
      }

      const anchor = shapeMap.get(id);
      dragSessionRef.current = {
        anchorId: id,
        anchorStartX: anchor?.x ?? 0,
        anchorStartY: anchor?.y ?? 0,
        ids,
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
      const dx = node.x() - session.anchorStartX;
      const dy = node.y() - session.anchorStartY;

      // Reuse existing Map to reduce GC pressure
      const positions = dragPositionsRef.current;
      positions.clear();
      for (const [sid, base] of session.basePositions) {
        if (sid === id) {
          positions.set(sid, { x: node.x(), y: node.y() });
        } else {
          positions.set(sid, { x: base.x + dx, y: base.y + dy });
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
      const stage = stageRef.current;

      // Commit final positions: read actual Konva node positions (one-time)
      const updates: Array<{ id: string; patch: Partial<Shape> }> = [];
      if (session.ids.length <= 1) {
        updates.push({ id, patch: { x: node.x(), y: node.y() } });
      } else if (stage) {
        for (const sid of session.ids) {
          const sNode = stage.findOne(`#${sid}`);
          if (sNode) {
            updates.push({ id: sid, patch: { x: sNode.x(), y: sNode.y() } });
          }
        }
      }

      if (updates.length <= 1 && updates.length > 0) {
        updateShape(updates[0].id, updates[0].patch);
      } else if (updates.length > 1) {
        updateShapes(updates);
      }

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
    [stageRef, updateShape, updateShapes, onLiveDragEnd, onUnlockShapes]
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
