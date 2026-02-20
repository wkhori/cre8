"use client";

import { useEffect, useRef } from "react";
import { useUIStore } from "@/store/ui-store";
import { useDebugStore } from "@/store/debug-store";

export default function DebugDashboard() {
  // Debug-only metrics
  const fps = useDebugStore((s) => s.fps);
  const frameMs = useDebugStore((s) => s.frameMs);
  const pointer = useDebugStore((s) => s.pointer);
  const shapeCount = useDebugStore((s) => s.shapeCount);
  const selectedId = useDebugStore((s) => s.selectedId);
  // App-critical state (from ui-store)
  const viewport = useUIStore((s) => s.viewport);
  const interaction = useUIStore((s) => s.interaction);
  const activeTool = useUIStore((s) => s.activeTool);

  // FPS counter using rAF
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const setFps = useDebugStore.getState().setFps;
    let running = true;

    const loop = (now: number) => {
      if (!running) return;
      frameCountRef.current++;
      const elapsed = now - lastTimeRef.current;

      if (elapsed >= 500) {
        const currentFps = Math.round((frameCountRef.current / elapsed) * 1000);
        const avgFrameMs = Number((elapsed / frameCountRef.current).toFixed(1));
        setFps(currentFps, avgFrameMs);
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const fpsColor = fps >= 55 ? "text-green-400" : fps >= 30 ? "text-yellow-400" : "text-red-400";

  return (
    <div
      className="fixed top-12 right-2 z-50 w-64 rounded-lg border border-zinc-700 bg-zinc-900/90 p-3 font-mono text-xs text-zinc-300 shadow-lg backdrop-blur-sm"
      style={{ pointerEvents: "none" }}
    >
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Debug
      </div>

      <Row label="FPS" value={<span className={fpsColor}>{fps}</span>} />
      <Row label="Frame" value={`${frameMs} ms`} />
      <Divider />
      <Row label="Shapes" value={shapeCount} />
      <Row label="Selected" value={selectedId ?? "none"} />
      <Row label="Interaction" value={interaction} />
      <Row label="Tool" value={activeTool} />
      <Divider />
      <Row label="Zoom" value={`${(viewport.scale * 100).toFixed(0)}%`} />
      <Row label="Pan" value={`${viewport.x.toFixed(0)}, ${viewport.y.toFixed(0)}`} />
      <Divider />
      <Row label="Screen" value={`${pointer.screenX.toFixed(0)}, ${pointer.screenY.toFixed(0)}`} />
      <Row label="World" value={`${pointer.worldX.toFixed(0)}, ${pointer.worldY.toFixed(0)}`} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-px">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-200">{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="my-1 border-t border-zinc-700/50" />;
}
