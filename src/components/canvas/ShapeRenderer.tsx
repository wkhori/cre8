"use client";

import { Rect, Ellipse, Text, Line, Group, Arrow } from "react-konva";
import type Konva from "konva";
import type { Shape } from "@/lib/types";

interface ShapeRendererProps {
  shape: Shape;
  isSelected: boolean;
  isDark?: boolean;
  onSelect: (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart: (id: string) => void;
  onDragMove?: (id: string, e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (id: string, e: Konva.KonvaEventObject<DragEvent>) => void;
  onDblClick?: (id: string, e: Konva.KonvaEventObject<MouseEvent>) => void;
}

export default function ShapeRenderer({
  shape,
  isSelected,
  isDark,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDblClick,
}: ShapeRendererProps) {
  const commonProps = {
    id: shape.id,
    name: "canvas-shape",
    x: shape.x,
    y: shape.y,
    rotation: shape.rotation,
    opacity: shape.opacity,
    draggable: true,
    perfectDrawEnabled: false,
    onClick: (e: Konva.KonvaEventObject<MouseEvent>) => onSelect(shape.id, e),
    onTap: (e: Konva.KonvaEventObject<TouchEvent>) => onSelect(shape.id, e),
    onDragStart: () => onDragStart(shape.id),
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => onDragMove?.(shape.id, e),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => onDragEnd(shape.id, e),
    onDblClick: (e: Konva.KonvaEventObject<MouseEvent>) => onDblClick?.(shape.id, e),
    onDblTap: (e: Konva.KonvaEventObject<TouchEvent>) => onDblClick?.(shape.id, e as unknown as Konva.KonvaEventObject<MouseEvent>),
  };

  switch (shape.type) {
    case "rect":
      return (
        <Rect
          key={shape.id}
          {...commonProps}
          width={shape.w}
          height={shape.h}
          fill={shape.fill}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth ?? 0}
          cornerRadius={shape.cornerRadius ?? 0}
        />
      );

    case "circle":
      return (
        <Ellipse
          key={shape.id}
          {...commonProps}
          radiusX={shape.radiusX}
          radiusY={shape.radiusY}
          fill={shape.fill}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth ?? 0}
        />
      );

    case "text": {
      // Resolve fill: if the stored fill is a dark color and we're in dark mode,
      // flip to light (and vice versa). This handles shapes created before
      // theme-aware creation was added.
      const textFill =
        shape.fill === "#18181b" && isDark
          ? "#fafafa"
          : shape.fill === "#fafafa" && !isDark
            ? "#18181b"
            : shape.fill;
      return (
        <Text
          key={shape.id}
          {...commonProps}
          text={shape.text}
          fontSize={shape.fontSize}
          fontFamily={shape.fontFamily}
          fill={textFill}
          width={shape.width}
          align={shape.align ?? "left"}
        />
      );
    }

    case "line":
      return (
        <Line
          key={shape.id}
          {...commonProps}
          points={shape.points}
          stroke={isSelected ? "#3b82f6" : shape.stroke}
          strokeWidth={shape.strokeWidth}
          lineCap="round"
          lineJoin="round"
          hitStrokeWidth={Math.max(shape.strokeWidth, 10)}
        />
      );

    case "sticky":
      return (
        <Group key={shape.id} {...commonProps}>
          <Rect
            width={shape.w}
            height={shape.h}
            fill={shape.color}
            cornerRadius={4}
            shadowColor="rgba(0,0,0,0.12)"
            shadowBlur={8}
            shadowOffsetY={2}
            perfectDrawEnabled={false}
          />
          <Text
            x={12}
            y={12}
            width={shape.w - 24}
            height={shape.h - 24}
            text={shape.text}
            fontSize={shape.fontSize ?? 16}
            fontFamily="system-ui, sans-serif"
            fill="#18181b"
            wrap="word"
            ellipsis
            perfectDrawEnabled={false}
          />
        </Group>
      );

    case "frame":
      return (
        <Group key={shape.id} {...commonProps}>
          <Rect
            width={shape.w}
            height={shape.h}
            fill={shape.fill}
            stroke={shape.stroke}
            strokeWidth={1}
            dash={[6, 4]}
            cornerRadius={4}
            perfectDrawEnabled={false}
          />
          <Text
            x={8}
            y={-20}
            text={shape.title}
            fontSize={13}
            fontFamily="system-ui, sans-serif"
            fill="#71717a"
            perfectDrawEnabled={false}
          />
        </Group>
      );

    case "connector": {
      const pts = shape.points ?? [0, 0, 100, 0];
      if (shape.style === "arrow") {
        return (
          <Arrow
            key={shape.id}
            {...commonProps}
            points={pts}
            stroke={shape.stroke}
            strokeWidth={shape.strokeWidth}
            fill={shape.stroke}
            pointerLength={10}
            pointerWidth={8}
            hitStrokeWidth={Math.max(shape.strokeWidth, 10)}
            perfectDrawEnabled={false}
          />
        );
      }
      return (
        <Line
          key={shape.id}
          {...commonProps}
          points={pts}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          hitStrokeWidth={Math.max(shape.strokeWidth, 10)}
          perfectDrawEnabled={false}
        />
      );
    }

    default:
      return null;
  }
}
