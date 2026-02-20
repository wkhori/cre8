"use client";

import { useRef, useCallback, useState } from "react";
import { useCanvasStore } from "@/store/canvas-store";
import { useDebugStore } from "@/store/debug-store";

interface DrawingBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function usePlacement() {
  const drawOriginRef = useRef<{ x: number; y: number } | null>(null);
  const [drawingBounds, setDrawingBounds] = useState<DrawingBounds | null>(null);

  const handlePlacementMouseDown = useCallback((worldX: number, worldY: number): boolean => {
    const tool = useDebugStore.getState().activeTool;

    // Click-to-place tools: create shape immediately
    if (tool === "place-rect") {
      useCanvasStore.getState().addRect(worldX, worldY);
      useDebugStore.getState().setActiveTool("pointer");
      return true;
    }
    if (tool === "place-circle") {
      useCanvasStore.getState().addCircle(worldX, worldY);
      useDebugStore.getState().setActiveTool("pointer");
      return true;
    }
    if (tool === "place-text") {
      const id = useCanvasStore.getState().addText(worldX, worldY);
      useDebugStore.getState().setActiveTool("pointer");
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent("start-text-edit", { detail: { id } }));
      });
      return true;
    }
    if (tool === "place-sticky") {
      const id = useCanvasStore.getState().addStickyNote(worldX, worldY);
      useDebugStore.getState().setActiveTool("pointer");
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent("start-text-edit", { detail: { id } }));
      });
      return true;
    }

    // Draw-frame: start drawing
    if (tool === "draw-frame") {
      drawOriginRef.current = { x: worldX, y: worldY };
      setDrawingBounds({ x: worldX, y: worldY, w: 0, h: 0 });
      return true;
    }

    return false;
  }, []);

  const handlePlacementMouseMove = useCallback((worldX: number, worldY: number): boolean => {
    const tool = useDebugStore.getState().activeTool;
    if (tool !== "draw-frame" || !drawOriginRef.current) return false;

    const origin = drawOriginRef.current;
    setDrawingBounds({
      x: Math.min(origin.x, worldX),
      y: Math.min(origin.y, worldY),
      w: Math.abs(worldX - origin.x),
      h: Math.abs(worldY - origin.y),
    });
    return true;
  }, []);

  const handlePlacementMouseUp = useCallback((worldX: number, worldY: number): boolean => {
    const tool = useDebugStore.getState().activeTool;
    if (tool !== "draw-frame" || !drawOriginRef.current) return false;

    const origin = drawOriginRef.current;
    drawOriginRef.current = null;
    setDrawingBounds(null);

    const x = Math.min(origin.x, worldX);
    const y = Math.min(origin.y, worldY);
    const w = Math.abs(worldX - origin.x);
    const h = Math.abs(worldY - origin.y);

    if (w > 10 && h > 10) {
      useCanvasStore.getState().addFrameAtBounds(x, y, w, h);
    } else {
      // Too small — create default-sized frame at click point
      useCanvasStore.getState().addFrameAtBounds(origin.x - 200, origin.y - 150, 400, 300);
    }
    useDebugStore.getState().setActiveTool("pointer");
    return true;
  }, []);

  const activeTool = useDebugStore((s) => s.activeTool);
  const isPlacementActive = activeTool.startsWith("place-") || activeTool === "draw-frame";

  return {
    handlePlacementMouseDown,
    handlePlacementMouseMove,
    handlePlacementMouseUp,
    drawingBounds,
    isPlacementActive,
  };
}
