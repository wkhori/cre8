"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type Konva from "konva";
import type { Bounds } from "@/lib/shape-geometry";
import { getShapeBounds } from "@/lib/shape-geometry";
import { getSelectionHitIds } from "@/lib/selection";
import { useCanvasStore } from "@/store/canvas-store";
import { useDebugStore } from "@/store/debug-store";

export function useRubberBandSelection(
  stageRef: React.RefObject<Konva.Stage | null>,
  layerRef: React.RefObject<Konva.Layer | null>
) {
  const selectionRectRef = useRef<Konva.Rect | null>(null);
  const isSelectingRef = useRef(false);
  const selectionStartRef = useRef({ x: 0, y: 0 });
  const [selectionBounds, setSelectionBounds] = useState<Bounds | null>(null);

  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const setSelected = useCanvasStore((s) => s.setSelected);

  // Compute selection bounds when selectedIds change
  const computeSelectionBounds = useCallback((): Bounds | null => {
    if (selectedIds.length === 0) return null;

    const stage = stageRef.current;
    if (stage) {
      const layer = layerRef.current ?? undefined;
      const nodes = selectedIds
        .map((id) => stage.findOne(`#${id}`))
        .filter(Boolean) as Konva.Node[];

      if (nodes.length > 0) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const node of nodes) {
          const rect = node.getClientRect({ skipShadow: true, relativeTo: layer });
          minX = Math.min(minX, rect.x);
          minY = Math.min(minY, rect.y);
          maxX = Math.max(maxX, rect.x + rect.width);
          maxY = Math.max(maxY, rect.y + rect.height);
        }

        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      }
    }

    // Fallback: compute from store shapes
    const currentShapes = useCanvasStore.getState().shapes;
    const selSet = new Set(selectedIds);
    const selectedShapes = currentShapes.filter((shape) => selSet.has(shape.id));
    if (selectedShapes.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const shape of selectedShapes) {
      const bounds = getShapeBounds(shape);
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    }

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [selectedIds, stageRef, layerRef]);

  // Update selection bounds when selectedIds change
  useEffect(() => {
    setSelectionBounds(computeSelectionBounds());
  }, [computeSelectionBounds]);

  // Start rubber-band selection
  const startSelection = useCallback((worldX: number, worldY: number, shiftKey: boolean) => {
    isSelectingRef.current = true;
    selectionStartRef.current = { x: worldX, y: worldY };
    const selRect = selectionRectRef.current;
    if (selRect) {
      selRect.visible(true);
      selRect.x(worldX);
      selRect.y(worldY);
      selRect.width(0);
      selRect.height(0);
      selRect.getLayer()?.batchDraw();
    }
    useDebugStore.getState().setInteraction("selecting");

    if (!shiftKey) {
      useCanvasStore.getState().clearSelection();
    }
  }, []);

  // Update rubber-band rectangle during mouse move
  const updateSelection = useCallback((worldX: number, worldY: number): boolean => {
    if (!isSelectingRef.current) return false;
    const start = selectionStartRef.current;
    const selRect = selectionRectRef.current;
    if (selRect) {
      selRect.x(Math.min(start.x, worldX));
      selRect.y(Math.min(start.y, worldY));
      selRect.width(Math.abs(worldX - start.x));
      selRect.height(Math.abs(worldY - start.y));
      selRect.getLayer()?.batchDraw();
    }
    return true;
  }, []);

  // Finalize rubber-band selection on mouse up
  const endSelection = useCallback(
    (shiftKey: boolean): boolean => {
      if (!isSelectingRef.current) return false;
      isSelectingRef.current = false;
      const selRect = selectionRectRef.current;
      if (selRect) {
        const box = {
          x: selRect.x(),
          y: selRect.y(),
          w: selRect.width(),
          h: selRect.height(),
        };
        selRect.visible(false);
        selRect.getLayer()?.batchDraw();

        if (box.w > 3 || box.h > 3) {
          const allShapes = useCanvasStore.getState().shapes;
          const hitIds = getSelectionHitIds(allShapes, box);

          if (hitIds.length > 0) {
            if (shiftKey) {
              const existing = useCanvasStore.getState().selectedIds;
              const merged = [...new Set([...existing, ...hitIds])];
              setSelected(merged);
            } else {
              setSelected(hitIds);
            }
          }
        }
      }
      useDebugStore.getState().setInteraction("idle");
      return true;
    },
    [setSelected]
  );

  return {
    selectionRectRef,
    selectionBounds,
    startSelection,
    updateSelection,
    endSelection,
  };
}
