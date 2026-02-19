"use client";

import { useEffect, useCallback, useState } from "react";
import type Konva from "konva";
import type { Shape } from "@/lib/types";
import { useCanvasStore } from "@/store/canvas-store";
import { buildTransformPatch } from "@/lib/shape-transform";

export function useTransformer(
  stageRef: React.RefObject<Konva.Stage | null>,
  transformerRef: React.RefObject<Konva.Transformer | null>,
  connectorIds: Set<string>,
  textEditingId: string | null,
  connectorFromId: string | null
) {
  const [isTransforming, setIsTransforming] = useState(false);

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
  }, []);

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
    setIsTransforming(false);
  }, [transformerRef, updateShapes]);

  return {
    isTransforming,
    handleTransformStart,
    handleTransformEnd,
  };
}
