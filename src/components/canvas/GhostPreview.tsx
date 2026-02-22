"use client";

import { useRef, useEffect } from "react";
import { Rect, Ellipse, Text, Group } from "react-konva";
import type Konva from "konva";
import type { ActiveTool } from "@/store/ui-store";

interface GhostPreviewProps {
  activeTool: ActiveTool;
  drawingBounds: { x: number; y: number; w: number; h: number } | null;
  stageRef: React.RefObject<Konva.Stage | null>;
  viewportRef: React.RefObject<{ x: number; y: number; scale: number }>;
  isDark?: boolean;
}

export default function GhostPreview({
  activeTool,
  drawingBounds,
  stageRef,
  viewportRef,
  isDark,
}: GhostPreviewProps) {
  const groupRef = useRef<Konva.Group | null>(null);
  const visibleRef = useRef(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (activeTool === "draw-frame") return;
    if (!activeTool.startsWith("place-")) return;

    const stage = stageRef.current;
    if (!stage) return;

    const content = stage.content;
    if (!content) return;

    // Track latest mouse position; update ghost only once per frame
    let latestX = 0;
    let latestY = 0;
    let needsUpdate = false;
    let hideTimer = 0;

    const flush = () => {
      rafRef.current = 0;
      const node = groupRef.current;
      if (!node || !needsUpdate) return;
      needsUpdate = false;

      node.position({ x: latestX, y: latestY });
      if (!visibleRef.current) {
        node.visible(true);
        visibleRef.current = true;
      }
      node.getLayer()?.batchDraw();
    };

    const onMove = (e: MouseEvent) => {
      // Cancel any pending hide — cursor re-entered before it fired
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = 0;
      }

      const rect = content.getBoundingClientRect();
      const vp = viewportRef.current;
      latestX = (e.clientX - rect.left - vp.x) / vp.scale;
      latestY = (e.clientY - rect.top - vp.y) / vp.scale;
      needsUpdate = true;

      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(flush);
      }
    };

    const onLeave = () => {
      // Debounce the hide — if cursor re-enters within one frame we skip the
      // hide+show batchDraw pair that causes the lag spike at the toolbar edge.
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        hideTimer = 0;
        const node = groupRef.current;
        if (!node || !visibleRef.current) return;
        node.visible(false);
        visibleRef.current = false;
        node.getLayer()?.batchDraw();
      }, 32);
    };

    content.addEventListener("mousemove", onMove);
    content.addEventListener("mouseleave", onLeave);

    return () => {
      content.removeEventListener("mousemove", onMove);
      content.removeEventListener("mouseleave", onLeave);
      if (hideTimer) clearTimeout(hideTimer);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      const node = groupRef.current;
      if (node && visibleRef.current) {
        node.visible(false);
        node.getLayer()?.batchDraw();
      }
      visibleRef.current = false;
    };
  }, [activeTool, stageRef, viewportRef]);

  // ── Draw-frame: uses drawingBounds directly ────────────────────────
  if (activeTool === "draw-frame" && drawingBounds) {
    return (
      <Rect
        x={drawingBounds.x}
        y={drawingBounds.y}
        width={drawingBounds.w}
        height={drawingBounds.h}
        fill={isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.03)"}
        stroke={isDark ? "#71717a" : "#a1a1aa"}
        strokeWidth={1}
        dash={[6, 4]}
        opacity={0.7}
        listening={false}
        perfectDrawEnabled={false}
      />
    );
  }

  // ── Placement ghosts: positioned by ref, not React state ───────────
  if (activeTool === "place-rect") {
    return (
      <Group ref={groupRef} listening={false} visible={false}>
        <Rect
          x={-60}
          y={-40}
          width={120}
          height={80}
          fill="#3b82f6"
          opacity={0.25}
          cornerRadius={4}
          perfectDrawEnabled={false}
        />
      </Group>
    );
  }

  if (activeTool === "place-circle") {
    return (
      <Group ref={groupRef} listening={false} visible={false}>
        <Ellipse
          x={0}
          y={0}
          radiusX={45}
          radiusY={45}
          fill="#3b82f6"
          opacity={0.25}
          perfectDrawEnabled={false}
        />
      </Group>
    );
  }

  if (activeTool === "place-sticky") {
    return (
      <Group ref={groupRef} listening={false} visible={false}>
        <Rect
          x={-100}
          y={-100}
          width={200}
          height={200}
          fill="#fef08a"
          opacity={0.5}
          cornerRadius={4}
          perfectDrawEnabled={false}
        />
      </Group>
    );
  }

  if (activeTool === "place-text") {
    return (
      <Group ref={groupRef} listening={false} visible={false}>
        <Text
          x={0}
          y={-12}
          text="Text"
          fontSize={24}
          fontFamily="sans-serif"
          fill="#3b82f6"
          opacity={0.4}
          perfectDrawEnabled={false}
        />
      </Group>
    );
  }

  return null;
}
