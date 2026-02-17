"use client";

import { Rect, Text as KonvaText, Group } from "react-konva";
import type { Bounds } from "@/lib/shape-geometry";
import { getDimensionLabelMetrics } from "@/lib/dimension-label";

interface DimensionLabelProps {
  bounds: Bounds;
  viewportScale: number;
}

export default function DimensionLabel({ bounds, viewportScale }: DimensionLabelProps) {
  const { labelX, labelY, fontSize, padX, padY, label, labelWidth } =
    getDimensionLabelMetrics(bounds, viewportScale);

  return (
    <Group listening={false}>
      <Rect
        x={labelX - labelWidth / 2 - padX}
        y={labelY}
        width={labelWidth + padX * 2}
        height={fontSize + padY * 2}
        fill="#3b82f6"
        cornerRadius={3 / viewportScale}
      />
      <KonvaText
        x={labelX - labelWidth / 2}
        y={labelY + padY}
        text={label}
        fontSize={fontSize}
        fontFamily="system-ui, sans-serif"
        fill="#ffffff"
        width={labelWidth}
        align="center"
        listening={false}
      />
    </Group>
  );
}
