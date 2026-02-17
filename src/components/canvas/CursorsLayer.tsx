"use client";

import { useEffect, useState } from "react";
import { Layer, Group, Line, Text, Rect } from "react-konva";
import { useDebugStore } from "@/store/debug-store";
import {
  subscribeCursors,
  type CursorPosition,
} from "@/lib/presence";
import { shortName } from "@/lib/utils";

export interface CursorsLayerProps {
  boardId: string;
  myUid: string;
}

/** Renders remote user cursors on a separate Konva Layer. */
export default function CursorsLayer({ boardId, myUid }: CursorsLayerProps) {
  const [cursors, setCursors] = useState<CursorPosition[]>([]);
  const viewportScale = useDebugStore((s) => s.viewport.scale);

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
        <RemoteCursor
          key={cursor.uid}
          cursor={cursor}
          viewportScale={viewportScale}
        />
      ))}
    </Layer>
  );
}

function RemoteCursor({
  cursor,
  viewportScale,
}: {
  cursor: CursorPosition;
  viewportScale: number;
}) {
  const { x, y, displayName, color } = cursor;

  // Scale inversely to viewport so cursor stays constant screen size
  const s = 1 / viewportScale;

  // Figma-style pointer arrow — clean triangular shape
  const pointerPoints = [
    0, 0,
    0, 10.5,
    3, 8,
    5.5, 13,
    7.5, 12,
    5, 7.5,
    9, 7.5,
  ];

  const name = shortName(displayName);
  const labelWidth = name.length * 5.5 + 10;

  return (
    <Group x={x} y={y} scaleX={s} scaleY={s}>
      {/* Pointer arrow */}
      <Line
        points={pointerPoints}
        fill={color}
        stroke="#fff"
        strokeWidth={0.8}
        closed
        perfectDrawEnabled={false}
      />
      {/* Name label pill */}
      <Rect
        x={8}
        y={12}
        width={labelWidth}
        height={16}
        fill={color}
        cornerRadius={4}
        perfectDrawEnabled={false}
      />
      {/* Name text */}
      <Text
        x={13}
        y={14}
        text={name}
        fontSize={10}
        fontFamily="system-ui, -apple-system, sans-serif"
        fill="#fff"
        perfectDrawEnabled={false}
      />
    </Group>
  );
}
