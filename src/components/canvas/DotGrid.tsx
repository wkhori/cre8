"use client";

import { useMemo, useCallback } from "react";
import { Shape } from "react-konva";
import type Konva from "konva";

/** Base world-space grid spacing at 1x zoom. */
const BASE_SPACING = 24;

/** When apparent spacing drops below this, skip every 2nd/4th/… dot. */
const MIN_SCREEN_GAP = 28;

/** Dot size — constant 1.2 screen pixels. */
const DOT_SCREEN_PX = 1.2;

/** Hard cap: never render more than this many dots (perf safety). */
const MAX_DOTS = 6000;

interface DotGridProps {
  viewport: { x: number; y: number; scale: number };
  stageWidth: number;
  stageHeight: number;
  isDark: boolean;
}

export default function DotGrid({ viewport, stageWidth, stageHeight, isDark }: DotGridProps) {
  const fill = isDark ? "#4a4a52" : "#b4b4b4";

  const gridParams = useMemo(() => {
    const { x: panX, y: panY, scale } = viewport;

    // Double spacing until dots are comfortably spaced on screen
    let step = 1;
    while (BASE_SPACING * step * scale < MIN_SCREEN_GAP) {
      step *= 2;
    }

    const worldSpacing = BASE_SPACING * step;

    // Visible world-coordinate bounds
    const worldLeft = -panX / scale;
    const worldTop = -panY / scale;
    const worldRight = (stageWidth - panX) / scale;
    const worldBottom = (stageHeight - panY) / scale;

    const startCol = Math.floor(worldLeft / worldSpacing);
    const endCol = Math.ceil(worldRight / worldSpacing);
    const startRow = Math.floor(worldTop / worldSpacing);
    const endRow = Math.ceil(worldBottom / worldSpacing);

    // Safety cap
    const count = (endCol - startCol + 1) * (endRow - startRow + 1);
    if (count > MAX_DOTS || count <= 0) return null;

    // World-unit size: target DOT_SCREEN_PX on screen, but never smaller
    // than 1 world unit so canvas anti-aliasing doesn't erase the dot
    const worldSize = Math.max(DOT_SCREEN_PX / scale, 1);

    return { startCol, endCol, startRow, endRow, worldSpacing, worldSize };
  }, [viewport, stageWidth, stageHeight]);

  // Memoize sceneFunc so Konva doesn't see a new function reference every render
  const sceneFunc = useCallback(
    (ctx: Konva.Context) => {
      if (!gridParams) return;
      const { startCol, endCol, startRow, endRow, worldSpacing, worldSize } = gridParams;
      ctx.fillStyle = fill;
      const half = worldSize / 2;
      for (let row = startRow; row <= endRow; row++) {
        const y = row * worldSpacing - half;
        for (let col = startCol; col <= endCol; col++) {
          ctx.fillRect(col * worldSpacing - half, y, worldSize, worldSize);
        }
      }
    },
    [gridParams, fill]
  );

  if (!gridParams) return null;

  return <Shape listening={false} perfectDrawEnabled={false} sceneFunc={sceneFunc} />;
}
