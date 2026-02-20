"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import type Konva from "konva";
import { useDebugStore } from "@/store/debug-store";
import { throttle } from "@/lib/throttle";
import { getShapeBounds } from "@/lib/shape-geometry";
import { useCanvasStore } from "@/store/canvas-store";

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 10;

export interface ViewportState {
  scale: number;
  x: number;
  y: number;
}

export function useViewport(
  stageRef: React.RefObject<Konva.Stage | null>,
  containerRef: React.RefObject<HTMLDivElement | null>,
  transformerRef: React.RefObject<Konva.Transformer | null>
) {
  const viewportRef = useRef<ViewportState>({ scale: 1, x: 0, y: 0 });
  const sizeRef = useRef({ width: 800, height: 600 });
  const isPanningRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });

  // Reactive viewport for DotGrid (throttled)
  const [gridViewport, setGridViewport] = useState<ViewportState>({ x: 0, y: 0, scale: 1 });
  // Separate cull viewport — only updates when viewport moves enough to change visible shapes
  const [cullViewport, setCullViewport] = useState<ViewportState>({ x: 0, y: 0, scale: 1 });
  const lastCullRef = useRef<ViewportState>({ x: 0, y: 0, scale: 1 });
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });

  // Debounce timer for re-attaching Transformer after zoom ends
  const zoomReattachRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTrNodesRef = useRef<Konva.Node[]>([]);

  // Throttled debug store updates
  const throttledSetPointer = useMemo(() => throttle(useDebugStore.getState().setPointer, 33), []);
  const throttledSetViewport = useMemo(
    () => throttle(useDebugStore.getState().setViewport, 50),
    []
  );
  const throttledSetGrid = useMemo(() => throttle(setGridViewport, 50), []);

  const syncViewport = useCallback(() => {
    const vp = { ...viewportRef.current };
    throttledSetViewport(vp);
    throttledSetGrid(vp);

    // Only update cull viewport when view shifts enough to change visible shapes
    const last = lastCullRef.current;
    const w = sizeRef.current.width;
    const threshold = w * 0.15;
    const dx = Math.abs(vp.x - last.x);
    const dy = Math.abs(vp.y - last.y);
    const dScale = Math.abs(vp.scale - last.scale) / last.scale;
    if (dx > threshold || dy > threshold || dScale > 0.25) {
      lastCullRef.current = vp;
      setCullViewport(vp);
    }
  }, [throttledSetViewport, throttledSetGrid]);

  // ── Resize observer ──────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      sizeRef.current = { width, height };
      setStageSize({ width, height });
      const stage = stageRef.current;
      if (stage) {
        stage.width(width);
        stage.height(height);
      }
    });
    ro.observe(container);
    const rect = container.getBoundingClientRect();
    sizeRef.current = { width: rect.width, height: rect.height };
    setStageSize({ width: rect.width, height: rect.height });
    return () => ro.disconnect();
  }, [containerRef, stageRef]);

  // ── Reset view handler ───────────────────────────────────────────
  useEffect(() => {
    const handleReset = () => {
      const stage = stageRef.current;
      if (!stage) return;
      viewportRef.current = { scale: 1, x: 0, y: 0 };
      stage.scale({ x: 1, y: 1 });
      stage.position({ x: 0, y: 0 });
      stage.batchDraw();
      useDebugStore.getState().setViewport({ scale: 1, x: 0, y: 0 });
      setGridViewport({ scale: 1, x: 0, y: 0 });
      setCullViewport({ scale: 1, x: 0, y: 0 });
      lastCullRef.current = { scale: 1, x: 0, y: 0 };
    };
    window.addEventListener("reset-canvas-view", handleReset);
    return () => window.removeEventListener("reset-canvas-view", handleReset);
  }, [stageRef]);

  // ── Wheel zoom at cursor ─────────────────────────────────────────
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const oldScale = viewportRef.current.scale;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const factor = 1.08;
      let newScale = direction > 0 ? oldScale * factor : oldScale / factor;
      newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

      const mousePointTo = {
        x: (pointer.x - viewportRef.current.x) / oldScale,
        y: (pointer.y - viewportRef.current.y) / oldScale,
      };

      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };

      // Detach Transformer before batchDraw to avoid O(N) getClientRect
      const tr = transformerRef.current;
      if (tr) {
        const nodes = tr.nodes();
        if (nodes.length > 0) {
          savedTrNodesRef.current = nodes;
          tr.nodes([]);
        }
      }

      viewportRef.current = { scale: newScale, x: newPos.x, y: newPos.y };
      stage.scale({ x: newScale, y: newScale });
      stage.position(newPos);
      stage.batchDraw();
      syncViewport();

      // Debounce re-attach: only restore Transformer when zoom gesture stops
      if (zoomReattachRef.current) clearTimeout(zoomReattachRef.current);
      zoomReattachRef.current = setTimeout(() => {
        zoomReattachRef.current = null;
        const tr = transformerRef.current;
        if (tr && savedTrNodesRef.current.length > 0) {
          tr.nodes(savedTrNodesRef.current);
          savedTrNodesRef.current = [];
          tr.getLayer()?.batchDraw();
        }
      }, 150);
    },
    [stageRef, transformerRef, syncViewport]
  );

  // ── Programmatic zoom ────────────────────────────────────────────
  const zoomTo = useCallback(
    (targetScale: number, center?: { x: number; y: number }) => {
      const stage = stageRef.current;
      if (!stage) return;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, targetScale));
      const cx = center?.x ?? sizeRef.current.width / 2;
      const cy = center?.y ?? sizeRef.current.height / 2;
      const oldScale = viewportRef.current.scale;
      const mousePointTo = {
        x: (cx - viewportRef.current.x) / oldScale,
        y: (cy - viewportRef.current.y) / oldScale,
      };
      const newPos = {
        x: cx - mousePointTo.x * newScale,
        y: cy - mousePointTo.y * newScale,
      };
      viewportRef.current = { scale: newScale, x: newPos.x, y: newPos.y };
      stage.scale({ x: newScale, y: newScale });
      stage.position(newPos);
      stage.batchDraw();
      syncViewport();
      // Force cull update for large zoom jumps
      lastCullRef.current = viewportRef.current;
      setCullViewport({ ...viewportRef.current });
    },
    [stageRef, syncViewport]
  );

  // ── Zoom / fit event listeners ─────────────────────────────────
  useEffect(() => {
    const handleZoomTo = (evt: Event) => {
      const { scale, center } = (evt as CustomEvent).detail ?? {};
      if (typeof scale === "number") zoomTo(scale, center);
    };
    const handleFitToContent = () => {
      const shapes = useCanvasStore.getState().shapes;
      if (shapes.length === 0) {
        zoomTo(1);
        return;
      }
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const shape of shapes) {
        const b = getShapeBounds(shape);
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
      }
      const contentW = maxX - minX;
      const contentH = maxY - minY;
      const pad = 80;
      const sw = sizeRef.current.width;
      const sh = sizeRef.current.height;
      const scale = Math.min(
        (sw - pad * 2) / Math.max(contentW, 1),
        (sh - pad * 2) / Math.max(contentH, 1),
        MAX_SCALE
      );
      const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
      const stage = stageRef.current;
      if (!stage) return;
      const cx = minX + contentW / 2;
      const cy = minY + contentH / 2;
      const newPos = {
        x: sw / 2 - cx * clampedScale,
        y: sh / 2 - cy * clampedScale,
      };
      viewportRef.current = { scale: clampedScale, x: newPos.x, y: newPos.y };
      stage.scale({ x: clampedScale, y: clampedScale });
      stage.position(newPos);
      stage.batchDraw();
      syncViewport();
      lastCullRef.current = viewportRef.current;
      setCullViewport({ ...viewportRef.current });
    };
    const handlePanTo = (evt: Event) => {
      const { x: worldX, y: worldY } = (evt as CustomEvent).detail ?? {};
      const stage = stageRef.current;
      if (!stage || typeof worldX !== "number") return;
      const scale = viewportRef.current.scale;
      const newPos = {
        x: sizeRef.current.width / 2 - worldX * scale,
        y: sizeRef.current.height / 2 - worldY * scale,
      };
      viewportRef.current = { ...viewportRef.current, x: newPos.x, y: newPos.y };
      stage.position(newPos);
      stage.batchDraw();
      syncViewport();
      lastCullRef.current = viewportRef.current;
      setCullViewport({ ...viewportRef.current });
    };
    window.addEventListener("zoom-to", handleZoomTo);
    window.addEventListener("fit-to-content", handleFitToContent);
    window.addEventListener("pan-to", handlePanTo);
    return () => {
      window.removeEventListener("zoom-to", handleZoomTo);
      window.removeEventListener("fit-to-content", handleFitToContent);
      window.removeEventListener("pan-to", handlePanTo);
    };
  }, [stageRef, zoomTo, syncViewport]);

  // ── Panning helpers ──────────────────────────────────────────────
  const startPan = useCallback((screenPos: { x: number; y: number }) => {
    isPanningRef.current = true;
    lastPointerRef.current = { x: screenPos.x, y: screenPos.y };
    useDebugStore.getState().setInteraction("panning");
  }, []);

  const updatePan = useCallback(
    (screenPos: { x: number; y: number }) => {
      if (!isPanningRef.current) return false;
      const stage = stageRef.current;
      if (!stage) return false;

      const dx = screenPos.x - lastPointerRef.current.x;
      const dy = screenPos.y - lastPointerRef.current.y;
      lastPointerRef.current = { x: screenPos.x, y: screenPos.y };
      viewportRef.current = {
        ...viewportRef.current,
        x: viewportRef.current.x + dx,
        y: viewportRef.current.y + dy,
      };
      stage.position({
        x: viewportRef.current.x,
        y: viewportRef.current.y,
      });
      stage.batchDraw();
      syncViewport();
      return true;
    },
    [stageRef, syncViewport]
  );

  const endPan = useCallback(() => {
    if (!isPanningRef.current) return false;
    isPanningRef.current = false;
    useDebugStore.getState().setInteraction("idle");
    return true;
  }, []);

  return {
    viewportRef,
    sizeRef,
    gridViewport,
    cullViewport,
    stageSize,
    isPanning: isPanningRef,
    throttledSetPointer,
    syncViewport,
    handleWheel,
    startPan,
    updatePan,
    endPan,
    zoomTo,
  };
}
