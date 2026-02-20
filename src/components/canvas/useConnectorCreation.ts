"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useCanvasStore } from "@/store/canvas-store";
import { useUIStore } from "@/store/ui-store";
import { getShapeBounds } from "@/lib/shape-geometry";

export function useConnectorCreation() {
  const connectorFromIdRef = useRef<string | null>(null);
  const connectorFromPointRef = useRef<{ x: number; y: number } | null>(null);
  const [connectorFromId, setConnectorFromId] = useState<string | null>(null);
  const [connectorPreview, setConnectorPreview] = useState<number[] | null>(null);
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);

  const clearConnectorFrom = useCallback(() => {
    connectorFromIdRef.current = null;
    connectorFromPointRef.current = null;
    setConnectorFromId(null);
    setConnectorPreview(null);
    useUIStore.getState().setConnectorSourceSelected(false);
  }, []);

  // Clear connector creation state when switching away from connector tool
  useEffect(() => {
    let prevTool = useUIStore.getState().activeTool;
    return useUIStore.subscribe((state) => {
      const currTool = state.activeTool;
      if (currTool === prevTool) return; // only react to activeTool changes
      const wasCon = prevTool === "connector";
      prevTool = currTool; // update BEFORE calling clearConnectorFrom to prevent re-entry
      if (wasCon && currTool !== "connector") {
        clearConnectorFrom();
      }
    });
  }, [clearConnectorFrom]);

  const hasConnectorFrom = useCallback(
    () => connectorFromIdRef.current !== null || connectorFromPointRef.current !== null,
    []
  );

  const buildConnectorFrom = useCallback(() => {
    if (connectorFromIdRef.current) return { id: connectorFromIdRef.current };
    if (connectorFromPointRef.current) return { point: connectorFromPointRef.current };
    return null;
  }, []);

  /** Handle a canvas (empty area) click during connector tool. Returns true if handled. */
  const handleCanvasClick = useCallback(
    (worldX: number, worldY: number): boolean => {
      if (useUIStore.getState().activeTool !== "connector") return false;

      if (!hasConnectorFrom()) {
        connectorFromPointRef.current = { x: worldX, y: worldY };
        setConnectorFromId(null);
        setConnectorPreview(null);
        useUIStore.getState().setConnectorSourceSelected(true);
      } else {
        const from = buildConnectorFrom();
        if (from) {
          useCanvasStore
            .getState()
            .addConnector(from, { point: { x: worldX, y: worldY } }, "arrow");
          useUIStore.getState().setActiveTool("pointer");
        }
        clearConnectorFrom();
      }
      return true;
    },
    [hasConnectorFrom, buildConnectorFrom, clearConnectorFrom]
  );

  /** Handle a shape click during connector tool. Returns true if handled. */
  const handleShapeClick = useCallback(
    (id: string): boolean => {
      if (useUIStore.getState().activeTool !== "connector") return false;

      const shape = useCanvasStore.getState().shapes.find((s) => s.id === id);
      if (!shape || shape.type === "connector") return false;

      if (!hasConnectorFrom()) {
        connectorFromIdRef.current = id;
        connectorFromPointRef.current = null;
        setConnectorFromId(id);
        useCanvasStore.getState().setSelected([id]);
        useUIStore.getState().setConnectorSourceSelected(true);
      } else {
        const from = buildConnectorFrom();
        if (from && !("id" in from && from.id === id)) {
          useCanvasStore.getState().addConnector(from, { id }, "arrow");
          useUIStore.getState().setActiveTool("pointer");
        }
        clearConnectorFrom();
      }
      return true;
    },
    [hasConnectorFrom, buildConnectorFrom, clearConnectorFrom]
  );

  /** Update the connector preview line during mouse move. */
  const updatePreview = useCallback((worldX: number, worldY: number) => {
    if (!connectorFromIdRef.current && !connectorFromPointRef.current) return;

    let fromCx: number, fromCy: number;
    if (connectorFromIdRef.current) {
      const fromShape = useCanvasStore
        .getState()
        .shapes.find((s) => s.id === connectorFromIdRef.current);
      if (fromShape) {
        const fb = getShapeBounds(fromShape);
        fromCx = fb.x + fb.width / 2;
        fromCy = fb.y + fb.height / 2;
      } else {
        fromCx = worldX;
        fromCy = worldY;
      }
    } else {
      fromCx = connectorFromPointRef.current!.x;
      fromCy = connectorFromPointRef.current!.y;
    }
    setConnectorPreview([fromCx, fromCy, worldX, worldY]);
  }, []);

  return {
    connectorFromId,
    connectorPreview,
    hoveredShapeId,
    setHoveredShapeId,
    handleCanvasClick,
    handleShapeClick,
    updatePreview,
  };
}
