"use client";

import { useEffect, useState, useRef } from "react";
import { Layer, Group, Line, Text, Rect } from "react-konva";
import { useUIStore } from "@/store/ui-store";
import { subscribeCursors, type CursorPosition } from "@/lib/presence";
import { shortName } from "@/lib/utils";

export interface CursorsLayerProps {
  boardId: string;
  myUid: string;
}

/** Renders remote user cursors on a separate Konva Layer. */
export default function CursorsLayer({ boardId, myUid }: CursorsLayerProps) {
  const [cursors, setCursors] = useState<CursorPosition[]>([]);
  const viewportScale = useUIStore((s) => s.viewport.scale);

  useEffect(() => {
    const unsubscribe = subscribeCursors(boardId, myUid, (remoteCursors) => {
      // Filter out stale cursors (>10s old)
      const now = Date.now();
      const fresh = remoteCursors.filter((c) => now - c.lastUpdated < 10_000);
      setCursors(fresh);
    });
    return unsubscribe;
  }, [boardId, myUid]);

  if (cursors.length === 0) return null;

  return (
    <Layer listening={false}>
      {cursors.map((cursor) => (
        <RemoteCursor key={cursor.uid} cursor={cursor} viewportScale={viewportScale} />
      ))}
    </Layer>
  );
}

/** Lerp toward target position for smooth cursor movement */
function useSmoothPosition(targetX: number, targetY: number) {
  const posRef = useRef({ x: targetX, y: targetY });
  const rafRef = useRef<number | null>(null);
  const [pos, setPos] = useState({ x: targetX, y: targetY });

  useEffect(() => {
    const animate = () => {
      const dx = targetX - posRef.current.x;
      const dy = targetY - posRef.current.y;

      // Snap if close enough (sub-pixel)
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        posRef.current = { x: targetX, y: targetY };
        setPos({ x: targetX, y: targetY });
        rafRef.current = null;
        return;
      }

      // Lerp factor — higher = snappier, lower = smoother
      const t = 0.35;
      posRef.current = {
        x: posRef.current.x + dx * t,
        y: posRef.current.y + dy * t,
      };
      setPos({ ...posRef.current });
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [targetX, targetY]);

  return pos;
}

function RemoteCursor({
  cursor,
  viewportScale,
}: {
  cursor: CursorPosition;
  viewportScale: number;
}) {
  const { x, y, displayName, color } = cursor;
  const smoothPos = useSmoothPosition(x, y);

  // Scale inversely to viewport so cursor stays constant screen size
  const s = 1 / viewportScale;

  // Compact Figma-style pointer — small, sharp, precise
  const pointerPoints = [
    0,
    0, // tip
    0,
    11.5, // left edge
    3.2,
    8.8, // notch
    5,
    13, // tail bottom
    6.8,
    12, // tail top
    5,
    7.8, // inner
    8.5,
    7.8, // right wing
  ];

  const name = shortName(displayName);
  const labelPadX = 5;
  const labelHeight = 16;
  const labelX = 8;
  const labelY = 12;
  const fontSize = 10;
  // Tighter estimate — periods and caps vary, so we center the text instead
  const labelWidth = name.length * 5.6 + labelPadX * 2;

  return (
    <Group x={smoothPos.x} y={smoothPos.y} scaleX={s} scaleY={s}>
      {/* Pointer — colored fill with white outline */}
      <Line
        points={pointerPoints}
        fill={color}
        stroke="#fff"
        strokeWidth={1}
        lineJoin="round"
        closed
        perfectDrawEnabled={false}
      />
      {/* Name label */}
      <Rect
        x={labelX}
        y={labelY}
        width={labelWidth}
        height={labelHeight}
        fill={color}
        cornerRadius={4}
        perfectDrawEnabled={false}
        shadowColor="rgba(0,0,0,0.2)"
        shadowBlur={4}
        shadowOffsetY={1}
        shadowEnabled
      />
      <Text
        x={labelX}
        y={labelY + 3}
        width={labelWidth}
        align="center"
        text={name}
        fontSize={fontSize}
        fontStyle="500"
        fontFamily="system-ui, -apple-system, sans-serif"
        fill="#fff"
        perfectDrawEnabled={false}
      />
    </Group>
  );
}
