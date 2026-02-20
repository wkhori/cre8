"use client";

import { useRef, useEffect, useCallback } from "react";
import { useCanvasStore } from "@/store/canvas-store";
import { useUIStore } from "@/store/ui-store";
import { getShapeBounds } from "@/lib/shape-geometry";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Maximize2 } from "lucide-react";

const MAP_W = 180;
const MAP_H = 110;

export default function MapControls() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const lastDrawRef = useRef(0);
  const scale = useUIStore((s) => s.viewport.scale);
  const pct = Math.round(scale * 100);

  // ── Minimap draw ─────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const now = performance.now();
    if (now - lastDrawRef.current < 100) return;
    lastDrawRef.current = now;

    const shapes = useCanvasStore.getState().shapes;
    const vp = useUIStore.getState().viewport;
    const isDark = document.documentElement.classList.contains("dark");
    const dpr = window.devicePixelRatio || 1;

    canvas.width = MAP_W * dpr;
    canvas.height = MAP_H * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = isDark ? "rgba(30,30,34,0.85)" : "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.roundRect(0, 0, MAP_W, MAP_H, 0);
    ctx.fill();

    if (shapes.length === 0) {
      ctx.strokeStyle = isDark ? "rgba(59,130,246,0.4)" : "rgba(59,130,246,0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      const boxW = MAP_W * 0.4;
      const boxH = MAP_H * 0.4;
      ctx.strokeRect((MAP_W - boxW) / 2, (MAP_H - boxH) / 2, boxW, boxH);
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

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const vpLeft = -vp.x / vp.scale;
    const vpTop = -vp.y / vp.scale;
    const vpRight = vpLeft + screenW / vp.scale;
    const vpBottom = vpTop + screenH / vp.scale;
    minX = Math.min(minX, vpLeft);
    minY = Math.min(minY, vpTop);
    maxX = Math.max(maxX, vpRight);
    maxY = Math.max(maxY, vpBottom);

    const pad = 40;
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;
    const worldW = maxX - minX;
    const worldH = maxY - minY;

    const mapPad = 6;
    const usableW = MAP_W - mapPad * 2;
    const usableH = MAP_H - mapPad * 2;
    const mapScale = Math.min(usableW / worldW, usableH / worldH);

    const toMapX = (wx: number) => mapPad + (wx - minX) * mapScale;
    const toMapY = (wy: number) => mapPad + (wy - minY) * mapScale;

    for (const shape of shapes) {
      if (shape.type === "connector") continue;
      const b = getShapeBounds(shape);
      const mx = toMapX(b.x);
      const my = toMapY(b.y);
      const mw = Math.max(b.width * mapScale, 2);
      const mh = Math.max(b.height * mapScale, 2);

      if (shape.type === "frame") {
        ctx.strokeStyle = isDark ? "rgba(161,161,170,0.4)" : "rgba(161,161,170,0.5)";
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 1]);
        ctx.strokeRect(mx, my, mw, mh);
        ctx.setLineDash([]);
      } else {
        let color: string;
        if (shape.type === "sticky") color = shape.color;
        else if (shape.type === "rect" || shape.type === "circle") color = shape.fill;
        else if (shape.type === "text") color = isDark ? "#a1a1aa" : "#71717a";
        else color = "#a1a1aa";

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.7;
        if (shape.type === "circle") {
          ctx.beginPath();
          ctx.ellipse(mx + mw / 2, my + mh / 2, mw / 2, mh / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.roundRect(mx, my, mw, mh, 1);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }

    const vx = toMapX(vpLeft);
    const vy = toMapY(vpTop);
    const vw = (screenW / vp.scale) * mapScale;
    const vh = (screenH / vp.scale) * mapScale;
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.strokeRect(vx, vy, vw, vh);
    ctx.fillStyle = "rgba(59,130,246,0.06)";
    ctx.fillRect(vx, vy, vw, vh);
  }, []);

  // Redraw on store changes instead of every-frame RAF loop.
  // Only subscribe to viewport slice of debug-store (not pointer, which fires 30fps).
  useEffect(() => {
    draw();

    const scheduleRedraw = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        draw();
      });
    };

    const unsubCanvas = useCanvasStore.subscribe(scheduleRedraw);
    // Subscribe only to viewport changes, not every debug-store update
    let prevVp = useUIStore.getState().viewport;
    const unsubDebug = useUIStore.subscribe((state) => {
      if (state.viewport !== prevVp) {
        prevVp = state.viewport;
        scheduleRedraw();
      }
    });

    return () => {
      unsubCanvas();
      unsubDebug();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [draw]);

  // ── Minimap click to pan ─────────────────────────────────────────
  const handleMinimapClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const shapes = useCanvasStore.getState().shapes;
    const vp = useUIStore.getState().viewport;
    if (shapes.length === 0) return;

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
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const vpLeft = -vp.x / vp.scale;
    const vpTop = -vp.y / vp.scale;
    const vpRight = vpLeft + screenW / vp.scale;
    const vpBottom = vpTop + screenH / vp.scale;
    minX = Math.min(minX, vpLeft);
    minY = Math.min(minY, vpTop);
    maxX = Math.max(maxX, vpRight);
    maxY = Math.max(maxY, vpBottom);

    const pad = 40;
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;
    const worldW = maxX - minX;
    const worldH = maxY - minY;
    const mapPad = 6;
    const usableW = MAP_W - mapPad * 2;
    const usableH = MAP_H - mapPad * 2;
    const mapScale = Math.min(usableW / worldW, usableH / worldH);

    const worldX = (clickX - mapPad) / mapScale + minX;
    const worldY = (clickY - mapPad) / mapScale + minY;

    window.dispatchEvent(new CustomEvent("pan-to", { detail: { x: worldX, y: worldY } }));
  }, []);

  // TODO: make  bottom-6 after finding better place for AI chat
  return (
    <div className="absolute bottom-15 right-4 z-30 flex flex-col overflow-hidden rounded-lg border border-zinc-200/80 bg-white/90 shadow-sm backdrop-blur-md dark:border-zinc-700/80 dark:bg-zinc-900/90">
      {/* Minimap */}
      <canvas
        ref={canvasRef}
        width={MAP_W}
        height={MAP_H}
        className="block cursor-pointer"
        style={{ width: MAP_W, height: MAP_H }}
        onClick={handleMinimapClick}
      />

      {/* Divider */}
      <div className="h-px bg-zinc-200/80 dark:bg-zinc-700/80" />

      {/* Zoom controls */}
      <div className="flex items-center justify-center gap-0.5 px-1 py-0.5">
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("zoom-to", { detail: { scale: scale / 1.25 } }))
          }
          title="Zoom out (Cmd+-)"
        >
          <Minus className="size-3.5" />
        </Button>

        <button
          onClick={() => window.dispatchEvent(new CustomEvent("zoom-to", { detail: { scale: 1 } }))}
          className="min-w-12 rounded px-1.5 py-0.5 text-center text-[11px] font-medium tabular-nums text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          title="Reset to 100% (Cmd+0)"
        >
          {pct}%
        </button>

        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("zoom-to", { detail: { scale: scale * 1.25 } }))
          }
          title="Zoom in (Cmd+=)"
        >
          <Plus className="size-3.5" />
        </Button>

        <div className="mx-0.5 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />

        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => window.dispatchEvent(new CustomEvent("fit-to-content"))}
          title="Fit to content (Cmd+1)"
        >
          <Maximize2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
