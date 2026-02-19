"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { Stage, Layer, Transformer, Rect, Line, Circle } from "react-konva";
import type Konva from "konva";
import type { Shape, ConnectorShape } from "@/lib/types";
import { useCanvasStore } from "@/store/canvas-store";
import { useDebugStore } from "@/store/debug-store";
import { getShapeBounds, connectorPairKey } from "@/lib/shape-geometry";
import ShapeRenderer from "./ShapeRenderer";
import DimensionLabel from "./DimensionLabel";
import DotGrid from "./DotGrid";
import CursorsLayer from "./CursorsLayer";
import { useCanvasKeyboard } from "./useCanvasKeyboard";
import { useTextEditing } from "./useTextEditing";
import { useConnectorCreation } from "./useConnectorCreation";
import { useViewport } from "./useViewport";
import { useDragSession } from "./useDragSession";
import { useRubberBandSelection } from "./useRubberBandSelection";
import { useTransformer } from "./useTransformer";
import { useConnectorEndpoints } from "./useConnectorEndpoints";

interface CanvasStageProps {
  boardId?: string;
  myUid?: string;
  onLiveDrag?: (shapes: Array<{ id: string; x: number; y: number }>) => void;
  onLiveDragEnd?: () => void;
}

export default function CanvasStage({
  boardId,
  myUid,
  onLiveDrag,
  onLiveDragEnd,
}: CanvasStageProps) {
  const stageRef = useRef<Konva.Stage | null>(null);
  const layerRef = useRef<Konva.Layer | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Store subscriptions ──────────────────────────────────────────
  const shapes = useCanvasStore((s) => s.shapes);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const setSelected = useCanvasStore((s) => s.setSelected);
  const toggleSelected = useCanvasStore((s) => s.toggleSelected);

  const activeTool = useDebugStore((s) => s.activeTool);
  const interaction = useDebugStore((s) => s.interaction);

  // ── Extracted hooks ──────────────────────────────────────────────
  const viewport = useViewport(stageRef, containerRef, transformerRef);

  const textEditing = useTextEditing(stageRef, viewport.viewportRef, shapes);

  const connector = useConnectorCreation();

  const drag = useDragSession(
    stageRef,
    viewport.viewportRef,
    viewport.throttledSetPointer,
    onLiveDrag,
    onLiveDragEnd
  );

  const rubberBand = useRubberBandSelection(stageRef, layerRef, viewport.viewportRef);

  // ── Space-held state for temporary hand mode ─────────────────────
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spaceHeldRef = useRef(false);

  const handleSpaceDown = useCallback(() => {
    spaceHeldRef.current = true;
    setSpaceHeld(true);
  }, []);

  const handleSpaceUp = useCallback(() => {
    spaceHeldRef.current = false;
    setSpaceHeld(false);
  }, []);

  useCanvasKeyboard({ onSpaceDown: handleSpaceDown, onSpaceUp: handleSpaceUp });

  // Track dark mode for canvas rendering (Konva can't use CSS vars)
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const effectiveTool = spaceHeld ? "hand" : activeTool;

  // ── Shape data pipeline (memos) ──────────────────────────────────
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Connector ID set
  const connectorIds = useMemo(
    () => new Set(shapes.filter((s) => s.type === "connector").map((s) => s.id)),
    [shapes]
  );

  // Keep drag session aware of connector existence
  drag.hasConnectorsRef.current = connectorIds.size > 0;

  // Pre-built sibling map for O(1) connector fan-out lookups
  const siblingMap = useMemo(() => {
    if (connectorIds.size === 0) return undefined;
    const map = new Map<string, ConnectorShape[]>();
    for (const s of shapes) {
      if (s.type === "connector" && s.fromId && s.toId) {
        const pk = connectorPairKey(s.fromId, s.toId);
        const arr = map.get(pk);
        if (arr) arr.push(s);
        else map.set(pk, [s]);
      }
    }
    return map;
  }, [shapes, connectorIds.size]);

  // Sort shapes by zIndex for rendering — depends on shapes directly
  // (not endpointDrag), so it doesn't cascade during endpoint drag
  const sortedShapes = useMemo(() => [...shapes].sort((a, b) => a.zIndex - b.zIndex), [shapes]);

  // O(1) shape lookup map
  const shapesById = useMemo(() => new Map(shapes.map((s) => [s.id, s])), [shapes]);

  // Connector endpoints hook (needs shapesById)
  const connectorEP = useConnectorEndpoints(shapesById, selectedIds, shapes);

  // Drag-aware shapes for connectors — applies local drag + endpoint drag
  // This is the ONLY memo that rebuilds during drag/endpoint drag
  const connectorAllShapes = useMemo(() => {
    let base = shapes;

    // Apply endpoint drag override for connector re-attachment preview
    if (connectorEP.endpointDrag) {
      const ep = connectorEP.endpointDrag;
      base = base.map((s) => {
        if (s.id !== ep.connectorId || s.type !== "connector") return s;
        if (ep.end === "from") {
          return { ...s, fromId: null, fromPoint: { x: ep.x, y: ep.y } } as Shape;
        }
        return { ...s, toId: null, toPoint: { x: ep.x, y: ep.y } } as Shape;
      });
    }

    if (connectorIds.size === 0) return base;

    // Apply local drag positions for connector tracking
    const dp = drag.dragPositionsRef.current;
    if (dp.size === 0) return base;

    return base.map((s) => {
      const localPos = dp.get(s.id);
      if (localPos) return { ...s, x: localPos.x, y: localPos.y };
      return s;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes, connectorIds.size, drag.dragEpoch, connectorEP.endpointDrag]);

  // Viewport culling: only render shapes visible on screen
  const visibleShapes = useMemo(() => {
    const vp = viewport.viewportRef.current;
    const pad = 200;
    const vpLeft = -vp.x / vp.scale - pad;
    const vpTop = -vp.y / vp.scale - pad;
    const vpRight = vpLeft + viewport.sizeRef.current.width / vp.scale + pad * 2;
    const vpBottom = vpTop + viewport.sizeRef.current.height / vp.scale + pad * 2;

    return sortedShapes.filter((shape) => {
      if (selectedIdSet.has(shape.id) || shape.type === "connector") return true;
      const b = getShapeBounds(shape);
      return (
        b.x + b.width >= vpLeft && b.x <= vpRight && b.y + b.height >= vpTop && b.y <= vpBottom
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedShapes, selectedIdSet, viewport.cullViewport]);

  // Transformer hook
  const transformer = useTransformer(
    stageRef,
    transformerRef,
    connectorIds,
    textEditing.editingTextId,
    connector.connectorFromId
  );

  // Cursor style
  const cursorStyle = useMemo(() => {
    if (effectiveTool === "hand") {
      return viewport.isPanning.current ? "grabbing" : "grab";
    }
    if (effectiveTool === "connector") return "crosshair";
    return "default";
  }, [effectiveTool, viewport.isPanning]);

  // ── Sync debug store ─────────────────────────────────────────────
  useEffect(() => {
    useDebugStore.getState().setObjectCount(shapes.length);
  }, [shapes.length]);

  useEffect(() => {
    useDebugStore
      .getState()
      .setSelectedId(
        textEditing.editingTextId
          ? `${textEditing.editingTextId} (editing)`
          : selectedIds.length === 1
            ? selectedIds[0]
            : selectedIds.length > 1
              ? `${selectedIds.length} shapes`
              : null
      );
  }, [textEditing.editingTextId, selectedIds]);

  useEffect(() => {
    useDebugStore.getState().setKonvaNodeCount(shapes.length);
  }, [shapes.length]);

  // ── Composed event handlers ──────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target !== stageRef.current) return;

      const stage = stageRef.current!;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      const vp = viewport.viewportRef.current;
      const worldX = (pos.x - vp.x) / vp.scale;
      const worldY = (pos.y - vp.y) / vp.scale;

      // Connector tool: delegate to hook
      if (connector.handleCanvasClick(worldX, worldY)) return;

      const isHand = spaceHeldRef.current || useDebugStore.getState().activeTool === "hand";

      if (isHand) {
        viewport.startPan({ x: pos.x, y: pos.y });
      } else {
        rubberBand.startSelection(worldX, worldY, e.evt.shiftKey);
      }
    },
    [connector, viewport, rubberBand]
  );

  const handleMouseMove = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    const vp = viewport.viewportRef.current;
    const worldX = (pos.x - vp.x) / vp.scale;
    const worldY = (pos.y - vp.y) / vp.scale;
    viewport.throttledSetPointer({
      screenX: pos.x,
      screenY: pos.y,
      worldX,
      worldY,
    });

    // Connector preview line
    connector.updatePreview(worldX, worldY);

    // Rubber-band selection takes priority
    if (rubberBand.updateSelection(worldX, worldY)) return;

    // Panning
    viewport.updatePan({ x: pos.x, y: pos.y });
  }, [viewport, connector, rubberBand]);

  const handleMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (rubberBand.endSelection(e.evt.shiftKey)) return;
      viewport.endPan();
    },
    [rubberBand, viewport]
  );

  // ── Shape click => select (or connector creation) ────────────────
  const handleShapeClick = useCallback(
    (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      e.cancelBubble = true;

      if (spaceHeldRef.current || useDebugStore.getState().activeTool === "hand") return;

      if (connector.handleShapeClick(id)) return;

      const evt = e.evt as MouseEvent;
      if (evt.shiftKey || evt.metaKey || evt.ctrlKey) {
        toggleSelected(id);
      } else {
        setSelected([id]);
      }
    },
    [setSelected, toggleSelected, connector]
  );

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden bg-[#ededed] dark:bg-[#1a1a1e]"
      style={{ cursor: cursorStyle }}
    >
      <Stage
        ref={stageRef}
        width={viewport.sizeRef.current.width}
        height={viewport.sizeRef.current.height}
        onWheel={viewport.handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Dot grid layer — behind everything, not interactive */}
        <Layer listening={false}>
          <DotGrid
            viewport={viewport.gridViewport}
            stageWidth={viewport.stageSize.width}
            stageHeight={viewport.stageSize.height}
            isDark={isDark}
          />
        </Layer>
        <Layer ref={layerRef}>
          {visibleShapes.map((shape) => (
            <ShapeRenderer
              key={shape.id}
              shape={shape}
              isSelected={selectedIdSet.has(shape.id)}
              isDark={isDark}
              allShapes={shape.type === "connector" ? connectorAllShapes : undefined}
              shapesById={shape.type === "connector" ? shapesById : undefined}
              siblingMap={shape.type === "connector" ? siblingMap : undefined}
              epoch={shape.type === "connector" ? drag.dragEpoch : undefined}
              isConnectorHover={activeTool === "connector" && connector.hoveredShapeId === shape.id}
              onSelect={handleShapeClick}
              onDragStart={drag.handleDragStart}
              onDragMove={drag.handleDragMove}
              onDragEnd={drag.handleDragEnd}
              onDblClick={textEditing.handleShapeDblClick}
              onMouseEnter={activeTool === "connector" ? connector.setHoveredShapeId : undefined}
              onMouseLeave={
                activeTool === "connector" ? () => connector.setHoveredShapeId(null) : undefined
              }
            />
          ))}

          {/* Connector preview line while creating */}
          {connector.connectorPreview && (
            <Line
              points={connector.connectorPreview}
              stroke="#3b82f6"
              strokeWidth={2}
              dash={[8, 4]}
              listening={false}
              perfectDrawEnabled={false}
            />
          )}

          {/* Draggable endpoint handles for selected connectors */}
          {connectorEP.selectedConnectorEndpoints.map((ep) => (
            <Circle
              key={`${ep.connectorId}-${ep.end}`}
              x={ep.x}
              y={ep.y}
              radius={6 / viewport.viewportRef.current.scale}
              fill="#fff"
              stroke="#3b82f6"
              strokeWidth={2 / viewport.viewportRef.current.scale}
              draggable
              perfectDrawEnabled={false}
              onDragMove={(e) => {
                connectorEP.setEndpointDrag({
                  connectorId: ep.connectorId,
                  end: ep.end,
                  x: e.target.x(),
                  y: e.target.y(),
                });
              }}
              onDragEnd={(e) => {
                connectorEP.setEndpointDrag(null);
                connectorEP.handleEndpointDragEnd(ep.connectorId, ep.end, e);
              }}
              onMouseEnter={(e) => {
                const container = e.target.getStage()?.container();
                if (container) container.style.cursor = "grab";
              }}
              onMouseLeave={(e) => {
                const container = e.target.getStage()?.container();
                if (container) container.style.cursor = cursorStyle;
              }}
            />
          ))}

          <Transformer
            ref={transformerRef}
            keepRatio={false}
            rotateEnabled={false}
            boundBoxFunc={(oldBox, newBox) => {
              if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
                return oldBox;
              }
              return newBox;
            }}
            onTransformStart={transformer.handleTransformStart}
            onTransformEnd={transformer.handleTransformEnd}
            anchorSize={8}
            anchorCornerRadius={2}
            borderStroke="#3b82f6"
            anchorStroke="#3b82f6"
            anchorFill="#fff"
            borderStrokeWidth={1}
            anchorStrokeWidth={1}
            padding={1}
          />

          <Rect
            ref={rubberBand.selectionRectRef}
            visible={false}
            fill="rgba(59,130,246,0.1)"
            stroke="#3b82f6"
            strokeWidth={1}
            dash={[4, 4]}
          />

          {rubberBand.selectionBounds &&
            !textEditing.editingTextId &&
            interaction !== "dragging" &&
            !transformer.isTransforming &&
            !selectedIds.every((id) => shapes.find((s) => s.id === id)?.type === "connector") && (
              <DimensionLabel
                bounds={rubberBand.selectionBounds}
                viewportScale={viewport.viewportRef.current.scale}
              />
            )}
        </Layer>
        {boardId && myUid && <CursorsLayer boardId={boardId} myUid={myUid} />}
      </Stage>

      {/* Text/sticky editing overlay */}
      {textEditing.editingTextId && textEditing.editingTextStyle && (
        <textarea
          ref={textEditing.textareaRef}
          value={textEditing.editingTextValue}
          onChange={textEditing.handleTextareaChange}
          onBlur={textEditing.commitTextEdit}
          onKeyDown={textEditing.handleTextareaKeyDown}
          style={textEditing.editingTextStyle}
        />
      )}
    </div>
  );
}
