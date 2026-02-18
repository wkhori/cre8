"use client";

import { Rect, Ellipse, Text, Line, Group, Arrow } from "react-konva";
import type Konva from "konva";
import type { Shape, ConnectorShape } from "@/lib/types";
import { getShapeBounds } from "@/lib/shape-geometry";

interface ShapeRendererProps {
  shape: Shape;
  isSelected: boolean;
  isDark?: boolean;
  allShapes?: Shape[];
  isConnectorHover?: boolean;
  onSelect: (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart: (id: string) => void;
  onDragMove?: (id: string, e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (id: string, e: Konva.KonvaEventObject<DragEvent>) => void;
  onDblClick?: (id: string, e: Konva.KonvaEventObject<MouseEvent>) => void;
  onMouseEnter?: (id: string) => void;
  onMouseLeave?: (id: string) => void;
}

function computeConnectorPoints(connector: ConnectorShape, allShapes: Shape[]): number[] {
  const fromShape = connector.fromId ? allShapes.find((s) => s.id === connector.fromId) : null;
  const toShape = connector.toId ? allShapes.find((s) => s.id === connector.toId) : null;

  // Resolve center points for each endpoint
  let fromCx: number, fromCy: number, fromBounds: ReturnType<typeof getShapeBounds> | null;
  if (fromShape) {
    fromBounds = getShapeBounds(fromShape);
    fromCx = fromBounds.x + fromBounds.width / 2;
    fromCy = fromBounds.y + fromBounds.height / 2;
  } else if (connector.fromPoint) {
    fromBounds = null;
    fromCx = connector.fromPoint.x;
    fromCy = connector.fromPoint.y;
  } else {
    return [0, 0, 100, 0];
  }

  let toCx: number, toCy: number, toBounds: ReturnType<typeof getShapeBounds> | null;
  if (toShape) {
    toBounds = getShapeBounds(toShape);
    toCx = toBounds.x + toBounds.width / 2;
    toCy = toBounds.y + toBounds.height / 2;
  } else if (connector.toPoint) {
    toBounds = null;
    toCx = connector.toPoint.x;
    toCy = connector.toPoint.y;
  } else {
    return [0, 0, 100, 0];
  }

  // Compute edge intersection when connected to a shape, raw point otherwise
  const startPt = fromBounds
    ? edgePoint(fromBounds, fromCx, fromCy, toCx, toCy)
    : { x: fromCx, y: fromCy };
  const endPt = toBounds ? edgePoint(toBounds, toCx, toCy, fromCx, fromCy) : { x: toCx, y: toCy };

  // Fan-out: offset connectors that share the same unordered {fromId, toId} pair
  if (connector.fromId && connector.toId) {
    const pairKey = [connector.fromId, connector.toId].sort().join("|");
    const siblings = allShapes.filter(
      (s) =>
        s.type === "connector" &&
        s.fromId &&
        s.toId &&
        [s.fromId, s.toId].sort().join("|") === pairKey
    );
    if (siblings.length > 1) {
      const idx = siblings.findIndex((s) => s.id === connector.id);
      const offset = (idx - (siblings.length - 1) / 2) * 20;
      // Perpendicular direction
      const dx = endPt.x - startPt.x;
      const dy = endPt.y - startPt.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const px = -dy / len;
      const py = dx / len;
      startPt.x += px * offset;
      startPt.y += py * offset;
      endPt.x += px * offset;
      endPt.y += py * offset;
    }
  }

  return [startPt.x, startPt.y, endPt.x, endPt.y];
}

/** Find the point where a ray from center toward target intersects the bounding rect. */
function edgePoint(
  bounds: { x: number; y: number; width: number; height: number },
  cx: number,
  cy: number,
  tx: number,
  ty: number
): { x: number; y: number } {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  const hw = bounds.width / 2;
  const hh = bounds.height / 2;

  // Scale factor to hit the bounding rect edge
  const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);

  return { x: cx + dx * s, y: cy + dy * s };
}

export default function ShapeRenderer({
  shape,
  isSelected,
  isDark,
  allShapes,
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

    case "sticky":
      return wrapWithHoverRing(
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
      return wrapWithHoverRing(
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
      const pts = allShapes
        ? computeConnectorPoints(shape, allShapes)
        : (shape.points ?? [0, 0, 100, 0]);
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
}
