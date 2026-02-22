"use client";

import { memo } from "react";
import { Rect, Ellipse, Text, Line, Group, Arrow } from "react-konva";
import type Konva from "konva";
import type { Shape } from "@/lib/types";
import { getShapeBounds, computeConnectorPoints } from "@/lib/shape-geometry";
import { computeStickyFontSize, STICKY_PAD_X, STICKY_PAD_Y } from "@/lib/sticky-text";
import { isLightColor } from "@/lib/colors";

interface ShapeRendererProps {
  shape: Shape;
  isSelected: boolean;
  isDark?: boolean;
  allShapes?: Shape[];
  shapesById?: Map<string, Shape>;
  siblingMap?: Map<string, import("@/lib/types").ConnectorShape[]>;
  isConnectorHover?: boolean;
  onSelect: (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart: (id: string) => void;
  onDragMove?: (id: string, e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (id: string, e: Konva.KonvaEventObject<DragEvent>) => void;
  onDblClick?: (id: string, e: Konva.KonvaEventObject<MouseEvent>) => void;
  onMouseEnter?: (id: string) => void;
  onMouseLeave?: (id: string) => void;
}

export default memo(function ShapeRenderer({
  shape,
  isSelected,
  isDark,
  allShapes,
  shapesById,
  siblingMap,
  isConnectorHover,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDblClick,
  onMouseEnter,
  onMouseLeave,
}: ShapeRendererProps) {
  const isConnector = shape.type === "connector";
  const commonProps = {
    id: shape.id,
    name: "canvas-shape",
    x: shape.x,
    y: shape.y,
    rotation: shape.rotation,
    opacity: shape.opacity,
    draggable: !isConnector,
    perfectDrawEnabled: false,
    onClick: (e: Konva.KonvaEventObject<MouseEvent>) => onSelect(shape.id, e),
    onTap: (e: Konva.KonvaEventObject<TouchEvent>) => onSelect(shape.id, e),
    onDragStart: () => onDragStart(shape.id),
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => onDragMove?.(shape.id, e),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => onDragEnd(shape.id, e),
    onDblClick: (e: Konva.KonvaEventObject<MouseEvent>) => onDblClick?.(shape.id, e),
    onDblTap: (e: Konva.KonvaEventObject<TouchEvent>) =>
      onDblClick?.(shape.id, e as unknown as Konva.KonvaEventObject<MouseEvent>),
    onMouseEnter: () => onMouseEnter?.(shape.id),
    onMouseLeave: () => onMouseLeave?.(shape.id),
  };

  // Connector hover ring helper — wraps a shape node in a Group with a blue highlight ring
  const wrapWithHoverRing = (node: React.ReactElement) => {
    if (!isConnectorHover || isConnector) return node;
    const bounds = getShapeBounds(shape);
    const pad = 4;
    return (
      <Group key={shape.id}>
        <Rect
          x={bounds.x - pad}
          y={bounds.y - pad}
          width={bounds.width + pad * 2}
          height={bounds.height + pad * 2}
          stroke="#3b82f6"
          strokeWidth={2}
          opacity={0.4}
          cornerRadius={4}
          listening={false}
          perfectDrawEnabled={false}
        />
        {node}
      </Group>
    );
  };

  switch (shape.type) {
    case "rect":
      return wrapWithHoverRing(
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
      return wrapWithHoverRing(
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
      return wrapWithHoverRing(
        <Text
          key={shape.id}
          {...commonProps}
          text={shape.text}
          fontSize={shape.fontSize}
          fontFamily={shape.fontFamily}
          fontStyle={shape.fontStyle ?? "normal"}
          textDecoration={shape.textDecoration ?? ""}
          fill={textFill}
          width={shape.width}
          align={shape.align ?? "left"}
        />
      );
    }

    case "line":
      return wrapWithHoverRing(
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

    case "sticky": {
      const availW = shape.w - STICKY_PAD_X * 2;
      const availH = shape.h - STICKY_PAD_Y * 2;
      const stickyFontSize = computeStickyFontSize(
        shape.text,
        availW,
        availH,
        shape.fontSize ?? 16
      );
      const stickyTextFill = isLightColor(shape.color) ? "#18181b" : "#fafafa";
      return wrapWithHoverRing(
        <Group key={shape.id} {...commonProps}>
          <Rect
            width={shape.w}
            height={shape.h}
            fill={shape.color}
            cornerRadius={4}
            perfectDrawEnabled={false}
          />
          <Text
            x={STICKY_PAD_X}
            y={STICKY_PAD_Y}
            width={availW}
            height={availH}
            text={shape.text}
            fontSize={stickyFontSize}
            fontFamily={shape.fontFamily ?? "system-ui, sans-serif"}
            fontStyle={shape.fontStyle ?? "normal"}
            textDecoration={shape.textDecoration ?? ""}
            fill={stickyTextFill}
            wrap="word"
            perfectDrawEnabled={false}
          />
        </Group>
      );
    }

    case "frame": {
      const frameFill = isDark ? "rgba(255,255,255,0.08)" : shape.fill;
      const frameStroke = isDark ? "#71717a" : shape.stroke;
      const frameTitleFill = isDark ? "#a1a1aa" : "#71717a";
      return wrapWithHoverRing(
        <Group key={shape.id} {...commonProps}>
          <Rect
            width={shape.w}
            height={shape.h}
            fill={frameFill}
            stroke={frameStroke}
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
            fill={frameTitleFill}
            perfectDrawEnabled={false}
          />
        </Group>
      );
    }

    case "connector": {
      const pts = allShapes
        ? computeConnectorPoints(shape, allShapes, shapesById, siblingMap)
        : (shape.points ?? [0, 0, 100, 0]);
      const dashArray =
        shape.lineStyle === "dashed" ? [12, 6] : shape.lineStyle === "dotted" ? [3, 6] : undefined;
      const connectorProps = {
        ...commonProps,
        // Connectors use absolute world coords in points, not x/y offset
        x: 0,
        y: 0,
        points: pts,
        stroke: isSelected ? "#3b82f6" : shape.stroke,
        strokeWidth: shape.strokeWidth,
        hitStrokeWidth: Math.max(shape.strokeWidth, 12),
        perfectDrawEnabled: false,
        ...(dashArray ? { dash: dashArray } : {}),
      };
      if (shape.style === "arrow") {
        return (
          <Arrow
            key={shape.id}
            {...connectorProps}
            fill={isSelected ? "#3b82f6" : shape.stroke}
            pointerLength={10}
            pointerWidth={8}
          />
        );
      }
      return <Line key={shape.id} {...connectorProps} />;
    }

    default:
      return null;
  }
});
