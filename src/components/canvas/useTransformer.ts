"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import type Konva from "konva";
import type { Shape } from "@/lib/types";
import { useCanvasStore } from "@/store/canvas-store";
import { buildTransformPatch } from "@/lib/shape-transform";
import { getShapeBounds } from "@/lib/shape-geometry";

export function useTransformer(
  stageRef: React.RefObject<Konva.Stage | null>,
  transformerRef: React.RefObject<Konva.Transformer | null>,
  connectorIds: Set<string>,
  textEditingId: string | null,
  connectorFromId: string | null,
  onLockShapes?: (ids: string[]) => void,
  onUnlockShapes?: () => void
) {
  const [isTransforming, setIsTransforming] = useState(false);
  const transformLockActiveRef = useRef(false);

  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const updateShapes = useCanvasStore((s) => s.updateShapes);

  // Attach transformer to selected nodes (exclude connectors)
  useEffect(() => {
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;

    if (selectedIds.length === 0 || textEditingId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }

    const excludeIds = new Set(connectorIds);
    if (connectorFromId) excludeIds.add(connectorFromId);
    const nodes = selectedIds
      .filter((id) => !excludeIds.has(id))
      .map((id) => stage.findOne(`#${id}`))
      .filter(Boolean) as Konva.Node[];

    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [stageRef, transformerRef, connectorFromId, textEditingId, selectedIds, connectorIds]);

  const handleTransformStart = useCallback(() => {
    setIsTransforming(true);
    const ids = useCanvasStore.getState().selectedIds;
    if (ids.length > 0) {
      onLockShapes?.(ids);
      transformLockActiveRef.current = true;
    }
  }, [onLockShapes]);

  const handleTransformEnd = useCallback(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const store = useCanvasStore.getState();
    store.pushHistory();
    const nodes = tr.nodes();
    const shapeById = new Map(store.shapes.map((shape) => [shape.id, shape]));
    const updates: Array<{ id: string; patch: Partial<Shape> }> = [];
    for (const node of nodes) {
      const id = node.id();
      const shape = shapeById.get(id);
      if (!shape) continue;

      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      const patch = buildTransformPatch(shape, {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX,
        scaleY,
      });

      node.scaleX(1);
      node.scaleY(1);

      updates.push({
        id,
        patch: patch as Partial<typeof shape>,
      });
    }
    updateShapes(updates);

    // Re-evaluate frame containment after resize: adopt new children + release excluded ones
    const freshShapes = useCanvasStore.getState().shapes;
    const childUpdates: Array<{ id: string; patch: Partial<Shape> }> = [];
    for (const upd of updates) {
      const frame = freshShapes.find((s) => s.id === upd.id);
      if (!frame || frame.type !== "frame") continue;
      const fx = frame.x,
        fy = frame.y,
        fr = fx + frame.w,
        fb = fy + frame.h;
      for (const child of freshShapes) {
        if (child.type === "connector") continue;
        if (child.id === frame.id) continue;
        const cb = getShapeBounds(child);
        const inside = cb.x >= fx && cb.y >= fy && cb.x + cb.width <= fr && cb.y + cb.height <= fb;
        if (inside && child.parentId !== frame.id && !child.parentId) {
          // Adopt: shape is now fully inside and has no parent
          childUpdates.push({ id: child.id, patch: { parentId: frame.id } });
        } else if (!inside && child.parentId === frame.id) {
          // Release: shape was a child but no longer fits
          childUpdates.push({ id: child.id, patch: { parentId: undefined } });
        }
      }
    }
    if (childUpdates.length > 0) updateShapes(childUpdates);

    setIsTransforming(false);
    if (transformLockActiveRef.current) {
      transformLockActiveRef.current = false;
      onUnlockShapes?.();
    }
  }, [transformerRef, updateShapes, onUnlockShapes]);

  useEffect(() => {
    return () => {
      if (!transformLockActiveRef.current) return;
      transformLockActiveRef.current = false;
      onUnlockShapes?.();
    };
  }, [onUnlockShapes]);

  return {
    isTransforming,
    handleTransformStart,
    handleTransformEnd,
  };
}
