"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { Stage, Layer, Transformer, Rect } from "react-konva";
import type Konva from "konva";
import type { Shape } from "@/lib/types";
import { useCanvasStore } from "@/store/canvas-store";
import { useDebugStore } from "@/store/debug-store";
import { throttle } from "@/lib/throttle";
import { getShapeBounds, type Bounds } from "@/lib/shape-geometry";
import { buildTransformPatch } from "@/lib/shape-transform";
import { getSelectionHitIds } from "@/lib/selection";
import ShapeRenderer from "./ShapeRenderer";
import DimensionLabel from "./DimensionLabel";
import CursorsLayer from "./CursorsLayer";
import { useCanvasKeyboard } from "./useCanvasKeyboard";

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;

interface CanvasStageProps {
  boardId?: string;
  myUid?: string;
  onLiveDrag?: (shapes: Array<{ id: string; x: number; y: number }>) => void;
  onLiveDragEnd?: () => void;
}

export default function CanvasStage({ boardId, myUid, onLiveDrag, onLiveDragEnd }: CanvasStageProps) {
  const stageRef = useRef<Konva.Stage | null>(null);
  const layerRef = useRef<Konva.Layer | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const selectionRectRef = useRef<Konva.Rect | null>(null);

  const shapes = useCanvasStore((s) => s.shapes);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const updateShape = useCanvasStore((s) => s.updateShape);
  const updateShapes = useCanvasStore((s) => s.updateShapes);
  const setSelected = useCanvasStore((s) => s.setSelected);
  const toggleSelected = useCanvasStore((s) => s.toggleSelected);
  const clearSelection = useCanvasStore((s) => s.clearSelection);

  const activeTool = useDebugStore((s) => s.activeTool);
  const interaction = useDebugStore((s) => s.interaction);
  const viewportScale = useDebugStore((s) => s.viewport.scale);

  const containerRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ width: 800, height: 600 });
  const isPanningRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const viewportRef = useRef({ scale: 1, x: 0, y: 0 });

  // Text/sticky editing state
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState("");
  const editingShapeTypeRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Space-held state for temporary hand mode
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spaceHeldRef = useRef(false);

  // Rubber-band selection state
  const isSelectingRef = useRef(false);
  const selectionStartRef = useRef({ x: 0, y: 0 });
  const [selectionBounds, setSelectionBounds] = useState<Bounds | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);

  // Track dragging shape IDs for live drag broadcast
  const draggingIdsRef = useRef<string[]>([]);

  // Track dark mode for canvas rendering (Konva can't use CSS vars)
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Determine effective tool: space overrides to hand temporarily
  const effectiveTool = spaceHeld ? "hand" : activeTool;

  // Sort shapes by zIndex for rendering
  const sortedShapes = useMemo(
    () => [...shapes].sort((a, b) => a.zIndex - b.zIndex),
    [shapes]
  );
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Cursor style based on tool
  const cursorStyle = useMemo(() => {
    if (effectiveTool === "hand") {
      return isPanningRef.current ? "grabbing" : "grab";
    }
    return "default";
  }, [effectiveTool]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────
  const handleSpaceDown = useCallback(() => {
    spaceHeldRef.current = true;
    setSpaceHeld(true);
  }, []);

  const handleSpaceUp = useCallback(() => {
    spaceHeldRef.current = false;
    setSpaceHeld(false);
  }, []);

  useCanvasKeyboard({ onSpaceDown: handleSpaceDown, onSpaceUp: handleSpaceUp });

  // ── Throttled debug updates ───────────────────────────────────────
  const throttledSetPointer = useMemo(
    () => throttle(useDebugStore.getState().setPointer, 33),
    []
  );
  const throttledSetViewport = useMemo(
    () => throttle(useDebugStore.getState().setViewport, 50),
    []
  );

  const computeSelectionBounds = useCallback((): Bounds | null => {
    if (selectedIds.length === 0) return null;

    const stage = stageRef.current;
    if (stage) {
      const layer = layerRef.current ?? undefined;
      const nodes = selectedIds
        .map((id) => stage.findOne(`#${id}`))
        .filter(Boolean) as Konva.Node[];

      if (nodes.length > 0) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const node of nodes) {
          const rect = node.getClientRect({ skipShadow: true, relativeTo: layer });
          minX = Math.min(minX, rect.x);
          minY = Math.min(minY, rect.y);
          maxX = Math.max(maxX, rect.x + rect.width);
          maxY = Math.max(maxY, rect.y + rect.height);
        }

        return {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        };
      }
    }

    const selectedShapes = shapes.filter((shape) => selectedIds.includes(shape.id));
    if (selectedShapes.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const shape of selectedShapes) {
      const bounds = getShapeBounds(shape);
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [selectedIds, shapes]);

  // ── Sync debug store ─────────────────────────────────────────────
  useEffect(() => {
    useDebugStore.getState().setObjectCount(shapes.length);
  }, [shapes.length]);

  useEffect(() => {
    useDebugStore
      .getState()
      .setSelectedId(
        editingTextId
          ? `${editingTextId} (editing)`
          : selectedIds.length === 1
          ? selectedIds[0]
          : selectedIds.length > 1
            ? `${selectedIds.length} shapes`
            : null
      );
  }, [editingTextId, selectedIds]);

  // ── Attach transformer to selected nodes ──────────────────────────
  useEffect(() => {
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;

    if (selectedIds.length === 0 || editingTextId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }

    const nodes = selectedIds
      .map((id) => stage.findOne(`#${id}`))
      .filter(Boolean) as Konva.Node[];

    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [editingTextId, selectedIds, shapes]);

  // ── Resize observer ───────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      sizeRef.current = { width, height };
      const stage = stageRef.current;
      if (stage) {
        stage.width(width);
        stage.height(height);
      }
    });
    ro.observe(container);
    const rect = container.getBoundingClientRect();
    sizeRef.current = { width: rect.width, height: rect.height };
    return () => ro.disconnect();
  }, []);

  // ── Reset view handler ────────────────────────────────────────────
  useEffect(() => {
    const handleReset = () => {
      const stage = stageRef.current;
      if (!stage) return;
      viewportRef.current = { scale: 1, x: 0, y: 0 };
      stage.scale({ x: 1, y: 1 });
      stage.position({ x: 0, y: 0 });
      stage.batchDraw();
      useDebugStore.getState().setViewport({ scale: 1, x: 0, y: 0 });
    };
    window.addEventListener("reset-canvas-view", handleReset);
    return () => window.removeEventListener("reset-canvas-view", handleReset);
  }, []);

  // ── Konva node count ──────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const stage = stageRef.current;
      if (stage) {
        const allNodes = stage.find("Rect, Ellipse, Text, Line");
        useDebugStore.getState().setKonvaNodeCount(allNodes.length + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setSelectionBounds(computeSelectionBounds());
  }, [computeSelectionBounds]);

  const syncViewport = useCallback(() => {
    throttledSetViewport({ ...viewportRef.current });
  }, [throttledSetViewport]);

  // ── Wheel zoom at cursor ──────────────────────────────────────────
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const oldScale = viewportRef.current.scale;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const factor = 1.08;
      let newScale = direction > 0 ? oldScale * factor : oldScale / factor;
      newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

      const mousePointTo = {
        x: (pointer.x - viewportRef.current.x) / oldScale,
        y: (pointer.y - viewportRef.current.y) / oldScale,
      };

      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };

      viewportRef.current = { scale: newScale, x: newPos.x, y: newPos.y };
      stage.scale({ x: newScale, y: newScale });
      stage.position(newPos);
      stage.batchDraw();
      syncViewport();
    },
    [syncViewport]
  );

  // ── Mouse down ────────────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target !== stageRef.current) return;

      const stage = stageRef.current!;
      const pos = stage.getPointerPosition();
      if (!pos) return;

      const isHand =
        spaceHeldRef.current ||
        useDebugStore.getState().activeTool === "hand";

      if (isHand) {
        isPanningRef.current = true;
        lastPointerRef.current = { x: pos.x, y: pos.y };
        useDebugStore.getState().setInteraction("panning");
      } else {
        const vp = viewportRef.current;
        const worldX = (pos.x - vp.x) / vp.scale;
        const worldY = (pos.y - vp.y) / vp.scale;

        isSelectingRef.current = true;
        selectionStartRef.current = { x: worldX, y: worldY };
        const selRect = selectionRectRef.current;
        if (selRect) {
          selRect.visible(true);
          selRect.x(worldX);
          selRect.y(worldY);
          selRect.width(0);
          selRect.height(0);
          selRect.getLayer()?.batchDraw();
        }
        useDebugStore.getState().setInteraction("selecting");

        if (!e.evt.shiftKey) {
          clearSelection();
        }
      }
    },
    [clearSelection]
  );

  // ── Mouse move ────────────────────────────────────────────────────
  const handleMouseMove = useCallback(
    () => {
      const stage = stageRef.current;
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;

      const vp = viewportRef.current;
      throttledSetPointer({
        screenX: pos.x,
        screenY: pos.y,
        worldX: (pos.x - vp.x) / vp.scale,
        worldY: (pos.y - vp.y) / vp.scale,
      });

      if (isSelectingRef.current) {
        const worldX = (pos.x - vp.x) / vp.scale;
        const worldY = (pos.y - vp.y) / vp.scale;
        const start = selectionStartRef.current;
        const selRect = selectionRectRef.current;
        if (selRect) {
          selRect.x(Math.min(start.x, worldX));
          selRect.y(Math.min(start.y, worldY));
          selRect.width(Math.abs(worldX - start.x));
          selRect.height(Math.abs(worldY - start.y));
          selRect.getLayer()?.batchDraw();
        }
        return;
      }

      if (isPanningRef.current) {
        const dx = pos.x - lastPointerRef.current.x;
        const dy = pos.y - lastPointerRef.current.y;
        lastPointerRef.current = { x: pos.x, y: pos.y };
        viewportRef.current = {
          ...viewportRef.current,
          x: viewportRef.current.x + dx,
          y: viewportRef.current.y + dy,
        };
        stage.position({
          x: viewportRef.current.x,
          y: viewportRef.current.y,
        });
        stage.batchDraw();
        syncViewport();
      }
    },
    [syncViewport, throttledSetPointer]
  );

  // ── Mouse up ──────────────────────────────────────────────────────
  const handleMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (isSelectingRef.current) {
        isSelectingRef.current = false;
        const selRect = selectionRectRef.current;
        if (selRect) {
          const box = {
            x: selRect.x(),
            y: selRect.y(),
            w: selRect.width(),
            h: selRect.height(),
          };
          selRect.visible(false);
          selRect.getLayer()?.batchDraw();

          if (box.w > 3 || box.h > 3) {
            const allShapes = useCanvasStore.getState().shapes;
            const hitIds = getSelectionHitIds(allShapes, box);

            if (hitIds.length > 0) {
              if (e.evt.shiftKey) {
                const existing = useCanvasStore.getState().selectedIds;
                const merged = [...new Set([...existing, ...hitIds])];
                setSelected(merged);
              } else {
                setSelected(hitIds);
              }
            }
          }
        }
        useDebugStore.getState().setInteraction("idle");
        return;
      }

      if (isPanningRef.current) {
        isPanningRef.current = false;
        useDebugStore.getState().setInteraction("idle");
      }
    },
    [setSelected]
  );

  // ── Shape click => select ─────────────────────────────────────────
  const handleShapeClick = useCallback(
    (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      e.cancelBubble = true;

      if (
        spaceHeldRef.current ||
        useDebugStore.getState().activeTool === "hand"
      )
        return;

      const evt = e.evt as MouseEvent;
      if (evt.shiftKey || evt.metaKey || evt.ctrlKey) {
        toggleSelected(id);
      } else {
        setSelected([id]);
      }
    },
    [setSelected, toggleSelected]
  );

  // ── Shape drag handlers ───────────────────────────────────────────
  const handleDragStart = useCallback(
    (id: string) => {
      useDebugStore.getState().setInteraction("dragging");
      // Save history BEFORE the drag so the move is undoable
      useCanvasStore.getState().pushHistory();
      const ids = useCanvasStore.getState().selectedIds;
      if (!ids.includes(id)) {
        setSelected([id]);
        draggingIdsRef.current = [id];
      } else {
        draggingIdsRef.current = ids;
      }
    },
    [setSelected]
  );

  // ── Live drag move handler: broadcast positions via RTDB ──────────
  const handleDragMove = useCallback(
    (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const stage = stageRef.current;
      if (!stage) return;

      // Update cursor position during drag (Stage onMouseMove may not fire)
      const pos = stage.getPointerPosition();
      if (pos) {
        const vp = viewportRef.current;
        throttledSetPointer({
          screenX: pos.x,
          screenY: pos.y,
          worldX: (pos.x - vp.x) / vp.scale,
          worldY: (pos.y - vp.y) / vp.scale,
        });
      }

      if (!onLiveDrag) return;

      // Collect positions of all dragging shapes
      const positions: Array<{ id: string; x: number; y: number }> = [];

      // For multi-select drag, all selected shapes move together
      const ids = draggingIdsRef.current;
      if (ids.length <= 1) {
        positions.push({ id, x: node.x(), y: node.y() });
      } else {
        for (const sid of ids) {
          const sNode = stage.findOne(`#${sid}`);
          if (sNode) {
            positions.push({ id: sid, x: sNode.x(), y: sNode.y() });
          }
        }
      }

      onLiveDrag(positions);
    },
    [onLiveDrag, throttledSetPointer]
  );

  const handleDragEnd = useCallback(
    (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const stage = stageRef.current;

      // Update all dragging shapes in store
      const ids = draggingIdsRef.current;
      if (ids.length <= 1) {
        updateShape(id, { x: node.x(), y: node.y() });
      } else if (stage) {
        const updates: Array<{ id: string; patch: Partial<Shape> }> = [];
        for (const sid of ids) {
          const sNode = stage.findOne(`#${sid}`);
          if (sNode) {
            updates.push({ id: sid, patch: { x: sNode.x(), y: sNode.y() } });
          }
        }
        updateShapes(updates);
      }

      draggingIdsRef.current = [];
      useDebugStore.getState().setInteraction("idle");

      // Clear live drag overlay on RTDB
      onLiveDragEnd?.();
    },
    [updateShape, updateShapes, onLiveDragEnd]
  );

  const beginTextEditing = useCallback(
    (id: string) => {
      const shape = useCanvasStore.getState().shapes.find((s) => s.id === id);
      if (!shape) return;
      // Support both "text" and "sticky" shape types for inline editing
      if (shape.type !== "text" && shape.type !== "sticky") return;

      editingShapeTypeRef.current = shape.type;
      setEditingTextId(id);
      setEditingTextValue(shape.text);

      const stage = stageRef.current;
      if (stage) {
        const node = stage.findOne(`#${id}`);
        if (node) {
          if (shape.type === "sticky") {
            // For sticky notes, only hide the Text child — keep the background Rect visible
            const group = node as Konva.Group;
            const textChild = group.findOne("Text");
            if (textChild) textChild.visible(false);
          } else {
            node.visible(false);
          }
          stage.batchDraw();
        }
      }

      setTimeout(() => textareaRef.current?.focus(), 0);
    },
    []
  );

  // ── Double-click to edit text ────────────────────────────────────
  const handleShapeDblClick = useCallback(
    (id: string) => {
      beginTextEditing(id);
    },
    [beginTextEditing]
  );

  useEffect(() => {
    const onStartTextEdit = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ id?: string }>;
      const id = customEvt.detail?.id;
      if (!id) return;
      beginTextEditing(id);
    };

    window.addEventListener("start-text-edit", onStartTextEdit as EventListener);
    return () =>
      window.removeEventListener("start-text-edit", onStartTextEdit as EventListener);
  }, [beginTextEditing]);

  const restoreEditingNode = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || !editingTextId) return;
    const node = stage.findOne(`#${editingTextId}`);
    if (node) {
      if (editingShapeTypeRef.current === "sticky") {
        const group = node as Konva.Group;
        const textChild = group.findOne("Text");
        if (textChild) textChild.visible(true);
      } else {
        node.visible(true);
      }
      stage.batchDraw();
    }
  }, [editingTextId]);

  const commitTextEdit = useCallback(() => {
    if (!editingTextId) return;
    const store = useCanvasStore.getState();
    const shapeType = editingShapeTypeRef.current;
    store.pushHistory();
    store.updateShape(editingTextId, {
      text: editingTextValue || (shapeType === "sticky" ? "" : "Text"),
    });

    restoreEditingNode();

    editingShapeTypeRef.current = null;
    setEditingTextId(null);
    setEditingTextValue("");
  }, [editingTextId, editingTextValue, restoreEditingNode]);

  // Compute textarea position for the editing shape
  const editingTextStyle = useMemo(() => {
    if (!editingTextId) return null;
    const shape = shapes.find((s) => s.id === editingTextId);
    if (!shape) return null;

    const vp = viewportRef.current;

    if (shape.type === "text") {
      const x = shape.x * vp.scale + vp.x;
      const y = shape.y * vp.scale + vp.y;
      const width = (shape.width ?? 200) * vp.scale;
      const fontSize = shape.fontSize * vp.scale;
      return {
        position: "absolute" as const,
        left: x,
        top: y,
        width,
        minHeight: fontSize + 4,
        fontSize,
        fontFamily: shape.fontFamily,
        color: shape.fill,
        border: "none",
        borderRadius: 0,
        background: "transparent",
        outline: "none",
        resize: "none" as const,
        padding: 0,
        margin: 0,
        lineHeight: 1,
        overflow: "hidden" as const,
        zIndex: 100,
      };
    }

    if (shape.type === "sticky") {
      const padX = 12;
      const padY = 12;
      const x = (shape.x + padX) * vp.scale + vp.x;
      const y = (shape.y + padY) * vp.scale + vp.y;
      const width = (shape.w - padX * 2) * vp.scale;
      const height = (shape.h - padY * 2) * vp.scale;
      const fontSize = (shape.fontSize ?? 16) * vp.scale;
      return {
        position: "absolute" as const,
        left: x,
        top: y,
        width,
        height,
        fontSize,
        fontFamily: "system-ui, sans-serif",
        color: "#18181b",
        border: "none",
        borderRadius: 0,
        background: "transparent",
        outline: "2px solid #3b82f6",
        resize: "none" as const,
        padding: 0,
        margin: 0,
        lineHeight: 1.4,
        overflow: "hidden" as const,
        zIndex: 100,
        wordBreak: "break-word" as const,
      };
    }

    return null;
  }, [editingTextId, shapes]);

  // ── Transform end ─────────────────────────────────────────────────
  const handleTransformEnd = useCallback(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const store = useCanvasStore.getState();
    store.pushHistory();
    const nodes = tr.nodes();
    const shapeById = new Map(store.shapes.map((shape) => [shape.id, shape]));
    const updates: Array<{ id: string; patch: Partial<Shape> }> = [];
    for (const node of nodes) {
      const id = node.id();
      const shape = shapeById.get(id);
      if (!shape) continue;

      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      const patch = buildTransformPatch(shape, {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX,
        scaleY,
      });

      node.scaleX(1);
      node.scaleY(1);

      updates.push({
        id,
        patch: patch as Partial<typeof shape>,
      });
    }
    updateShapes(updates);
    setIsTransforming(false);
  }, [updateShapes]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900"
      style={{ cursor: cursorStyle }}
    >
      <Stage
        ref={stageRef}
        width={sizeRef.current.width}
        height={sizeRef.current.height}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <Layer ref={layerRef}>
          {sortedShapes.map((shape) => (
            <ShapeRenderer
              key={shape.id}
              shape={shape}
              isSelected={selectedIdSet.has(shape.id)}
              isDark={isDark}
              onSelect={handleShapeClick}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onDblClick={handleShapeDblClick}
            />
          ))}

          <Transformer
            ref={transformerRef}
            keepRatio={false}
            rotateEnabled={false}
            boundBoxFunc={(oldBox, newBox) => {
              if (
                Math.abs(newBox.width) < 5 ||
                Math.abs(newBox.height) < 5
              ) {
                return oldBox;
              }
              return newBox;
            }}
            onTransformStart={() => setIsTransforming(true)}
            onTransformEnd={handleTransformEnd}
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
            ref={selectionRectRef}
            visible={false}
            fill="rgba(59,130,246,0.1)"
            stroke="#3b82f6"
            strokeWidth={1}
            dash={[4, 4]}
          />

          {selectionBounds && !editingTextId && interaction !== "dragging" && !isTransforming && (
            <DimensionLabel
              bounds={selectionBounds}
              viewportScale={viewportScale}
            />
          )}
        </Layer>
        {boardId && myUid && (
          <CursorsLayer boardId={boardId} myUid={myUid} />
        )}
      </Stage>

      {/* Text/sticky editing overlay */}
      {editingTextId && editingTextStyle && (
        <textarea
          ref={textareaRef}
          value={editingTextValue}
          onChange={(e) => {
            const val = e.target.value;
            setEditingTextValue(val);
            // Stream text changes live to the store (and thus to Firestore)
            if (editingTextId) {
              useCanvasStore.getState().updateShape(editingTextId, { text: val });
            }
          }}
          onBlur={commitTextEdit}
          onKeyDown={(e) => {
            // For sticky notes, allow Enter for newlines; commit with Escape or Cmd+Enter
            const isSticky = editingShapeTypeRef.current === "sticky";
            if (e.key === "Enter" && !e.shiftKey && !isSticky) {
              e.preventDefault();
              commitTextEdit();
            }
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && isSticky) {
              e.preventDefault();
              commitTextEdit();
            }
            if (e.key === "Escape") {
              restoreEditingNode();
              editingShapeTypeRef.current = null;
              setEditingTextId(null);
              setEditingTextValue("");
            }
          }}
          style={editingTextStyle}
        />
      )}
    </div>
  );
}
