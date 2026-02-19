"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { Stage, Layer, Transformer, Rect, Line, Circle } from "react-konva";
import type Konva from "konva";
import type { Shape, ConnectorShape } from "@/lib/types";
import { useCanvasStore } from "@/store/canvas-store";
import { useDebugStore } from "@/store/debug-store";
import { throttle } from "@/lib/throttle";
import { getShapeBounds, edgeIntersection, type Bounds } from "@/lib/shape-geometry";
import { buildTransformPatch } from "@/lib/shape-transform";
import { getSelectionHitIds } from "@/lib/selection";
import ShapeRenderer from "./ShapeRenderer";
import DimensionLabel from "./DimensionLabel";
import DotGrid from "./DotGrid";
import CursorsLayer from "./CursorsLayer";
import { useCanvasKeyboard } from "./useCanvasKeyboard";
import { useTextEditing } from "./useTextEditing";
import { useConnectorCreation } from "./useConnectorCreation";

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;

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

  // Reactive viewport + size for DotGrid (updated on same throttle as debug store)
  const [gridViewport, setGridViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });

  // Text/sticky editing (extracted hook)
  const textEditing = useTextEditing(stageRef, viewportRef, shapes);

  // Space-held state for temporary hand mode
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spaceHeldRef = useRef(false);

  // Rubber-band selection state
  const isSelectingRef = useRef(false);
  const selectionStartRef = useRef({ x: 0, y: 0 });
  const [selectionBounds, setSelectionBounds] = useState<Bounds | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);

  // ── DragSession: tracks all drag state in refs to avoid React re-renders ──
  interface DragSession {
    anchorId: string;
    anchorStartX: number;
    anchorStartY: number;
    ids: string[];
    basePositions: Map<string, { x: number; y: number }>;
  }
  const dragSessionRef = useRef<DragSession | null>(null);
  // RAF-batched drag positions: written to ref, flushed once per frame
  // Reuse a single Map to reduce GC pressure (Fix 3)
  const dragPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const dragRafRef = useRef<number>(0);
  // Counter increments per RAF frame during drag to trigger re-render for connectors
  const [dragEpoch, setDragEpoch] = useState(0);

  // Connector creation (extracted hook)
  const connector = useConnectorCreation();

  // Live endpoint drag for connector re-attachment
  const [endpointDrag, setEndpointDrag] = useState<{
    connectorId: string;
    end: "from" | "to";
    x: number;
    y: number;
  } | null>(null);

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

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Merge endpoint drag into shapes for connector re-attachment preview.
  // During shape drag, positions are applied per-shape in the render loop via
  // dragPositionsRef to avoid remapping the entire array every frame (Fix 1).
  const allShapesWithDrag = useMemo(() => {
    if (!endpointDrag) return shapes;

    return shapes.map((s) => {
      if (s.id !== endpointDrag.connectorId || s.type !== "connector") return s;
      if (endpointDrag.end === "from") {
        return {
          ...s,
          fromId: null,
          fromPoint: { x: endpointDrag.x, y: endpointDrag.y },
        } as Shape;
      } else {
        return { ...s, toId: null, toPoint: { x: endpointDrag.x, y: endpointDrag.y } } as Shape;
      }
    });
  }, [shapes, endpointDrag]);

  // Sort shapes by zIndex for rendering (use drag-merged shapes so connectors update live)
  const sortedShapes = useMemo(
    () => [...allShapesWithDrag].sort((a, b) => a.zIndex - b.zIndex),
    [allShapesWithDrag]
  );

  // O(1) shape lookup map — used by connector endpoints and transformer
  const shapesById = useMemo(
    () => new Map(allShapesWithDrag.map((s) => [s.id, s])),
    [allShapesWithDrag]
  );

  // Drag-aware shapes for connectors only — applies drag positions from ref
  // so connectors track their endpoints during drag. Only rebuilds on dragEpoch
  // (once per RAF frame) instead of remapping all shapes (Fix 1).
  const connectorAllShapes = useMemo(() => {
    const dp = dragPositionsRef.current;
    if (dp.size === 0) return allShapesWithDrag;
    // Only remap shapes that are being dragged
    return allShapesWithDrag.map((s) => {
      const pos = dp.get(s.id);
      return pos ? { ...s, x: pos.x, y: pos.y } : s;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dragEpoch triggers reads from dragPositionsRef
  }, [allShapesWithDrag, dragEpoch]);

  // Connector ID set — memoized separately so transformer doesn't re-run on every shape change
  const connectorIds = useMemo(
    () => new Set(shapes.filter((s) => s.type === "connector").map((s) => s.id)),
    [shapes]
  );

  // ── Viewport culling: only render shapes visible on screen ──
  // Uses gridViewport to re-cull on pan/zoom. During drag this still fires but
  // sortedShapes is frozen (drag positions live in ref, not state), so the
  // filter just re-runs cheaply on the same input (Fix 1).
  const visibleShapes = useMemo(() => {
    const vp = viewportRef.current;
    const pad = 200; // render shapes slightly outside viewport for smooth scroll
    const vpLeft = -vp.x / vp.scale - pad;
    const vpTop = -vp.y / vp.scale - pad;
    const vpRight = vpLeft + sizeRef.current.width / vp.scale + pad * 2;
    const vpBottom = vpTop + sizeRef.current.height / vp.scale + pad * 2;

    return sortedShapes.filter((shape) => {
      // Always render selected shapes and connectors
      if (selectedIdSet.has(shape.id) || shape.type === "connector") return true;
      const b = getShapeBounds(shape);
      return (
        b.x + b.width >= vpLeft && b.x <= vpRight && b.y + b.height >= vpTop && b.y <= vpBottom
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gridViewport intentionally triggers re-cull on pan/zoom
  }, [sortedShapes, selectedIdSet, gridViewport]);

  // Cursor style based on tool
  const cursorStyle = useMemo(() => {
    if (effectiveTool === "hand") {
      return isPanningRef.current ? "grabbing" : "grab";
    }
    if (effectiveTool === "connector") return "crosshair";
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
  const throttledSetPointer = useMemo(() => throttle(useDebugStore.getState().setPointer, 33), []);
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
        textEditing.editingTextId
          ? `${textEditing.editingTextId} (editing)`
          : selectedIds.length === 1
            ? selectedIds[0]
            : selectedIds.length > 1
              ? `${selectedIds.length} shapes`
              : null
      );
  }, [textEditing.editingTextId, selectedIds]);

  // ── Attach transformer to selected nodes (exclude connectors) ────
  useEffect(() => {
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;

    if (selectedIds.length === 0 || textEditing.editingTextId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }

    // Don't attach transformer to connector shapes or the connector source shape
    const excludeIds = new Set(connectorIds);
    if (connector.connectorFromId) excludeIds.add(connector.connectorFromId);
    const nodes = selectedIds
      .filter((id) => !excludeIds.has(id))
      .map((id) => stage.findOne(`#${id}`))
      .filter(Boolean) as Konva.Node[];

    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [connector.connectorFromId, textEditing.editingTextId, selectedIds, connectorIds]);

  // ── Resize observer ───────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      sizeRef.current = { width, height };
      setStageSize({ width, height });
      const stage = stageRef.current;
      if (stage) {
        stage.width(width);
        stage.height(height);
      }
    });
    ro.observe(container);
    const rect = container.getBoundingClientRect();
    sizeRef.current = { width: rect.width, height: rect.height };
    setStageSize({ width: rect.width, height: rect.height });
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
      setGridViewport({ scale: 1, x: 0, y: 0 });
    };
    window.addEventListener("reset-canvas-view", handleReset);
    return () => window.removeEventListener("reset-canvas-view", handleReset);
  }, []);

  // ── Konva node count (derived from shapes length, no stage traversal) ──
  useEffect(() => {
    useDebugStore.getState().setKonvaNodeCount(shapes.length);
  }, [shapes.length]);

  useEffect(() => {
    setSelectionBounds(computeSelectionBounds());
  }, [computeSelectionBounds]);

  // Throttle grid redraws separately — debug store already has its own throttle
  const throttledSetGrid = useMemo(() => throttle(setGridViewport, 50), []);

  const syncViewport = useCallback(() => {
    const vp = { ...viewportRef.current };
    throttledSetViewport(vp);
    throttledSetGrid(vp);
  }, [throttledSetViewport, throttledSetGrid]);

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
      const vp = viewportRef.current;
      const worldX = (pos.x - vp.x) / vp.scale;
      const worldY = (pos.y - vp.y) / vp.scale;

      // Connector tool: delegate to hook
      if (connector.handleCanvasClick(worldX, worldY)) return;

      const isHand = spaceHeldRef.current || useDebugStore.getState().activeTool === "hand";

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
    [clearSelection, connector]
  );

  // ── Mouse move ────────────────────────────────────────────────────
  const handleMouseMove = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    const vp = viewportRef.current;
    const worldX = (pos.x - vp.x) / vp.scale;
    const worldY = (pos.y - vp.y) / vp.scale;
    throttledSetPointer({
      screenX: pos.x,
      screenY: pos.y,
      worldX,
      worldY,
    });

    // Connector preview line
    connector.updatePreview(worldX, worldY);

    if (isSelectingRef.current) {
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
  }, [syncViewport, throttledSetPointer, connector]);

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

  // ── Shape click => select (or connector creation) ────────────────
  const handleShapeClick = useCallback(
    (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      e.cancelBubble = true;

      if (spaceHeldRef.current || useDebugStore.getState().activeTool === "hand") return;

      // Connector tool: delegate to hook
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

  // ── Shape drag handlers (DragSession + RAF batching) ─────────────
  const handleDragStart = useCallback(
    (id: string) => {
      useDebugStore.getState().setInteraction("dragging");
      useCanvasStore.getState().pushHistory();

      const store = useCanvasStore.getState();
      const ids = store.selectedIds.includes(id) ? store.selectedIds : [id];
      if (!store.selectedIds.includes(id)) setSelected([id]);

      // Build base positions from store (not Konva nodes)
      const shapeMap = new Map(store.shapes.map((s) => [s.id, s]));
      const basePositions = new Map<string, { x: number; y: number }>();
      for (const sid of ids) {
        const s = shapeMap.get(sid);
        if (s) basePositions.set(sid, { x: s.x, y: s.y });
      }

      const anchor = shapeMap.get(id);
      dragSessionRef.current = {
        anchorId: id,
        anchorStartX: anchor?.x ?? 0,
        anchorStartY: anchor?.y ?? 0,
        ids,
        basePositions,
      };
    },
    [setSelected]
  );

  // ── Live drag move: compute from anchor delta, RAF-batch the state update ──
  const handleDragMove = useCallback(
    (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const stage = stageRef.current;
      const session = dragSessionRef.current;
      if (!stage || !session) return;

      // Update cursor position during drag
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

      // Compute all positions from anchor delta (no stage.findOne calls)
      const dx = node.x() - session.anchorStartX;
      const dy = node.y() - session.anchorStartY;

      // Reuse existing Map to reduce GC pressure (Fix 3)
      const positions = dragPositionsRef.current;
      positions.clear();
      for (const [sid, base] of session.basePositions) {
        if (sid === id) {
          positions.set(sid, { x: node.x(), y: node.y() });
        } else {
          positions.set(sid, { x: base.x + dx, y: base.y + dy });
        }
      }

      // Schedule single RAF flush — bump epoch to trigger re-render (Fix 1)
      if (!dragRafRef.current) {
        dragRafRef.current = requestAnimationFrame(() => {
          dragRafRef.current = 0;
          setDragEpoch((e) => e + 1);
        });
      }

      // Broadcast positions via RTDB for remote users
      if (!onLiveDrag) return;
      const broadcast: Array<{ id: string; x: number; y: number }> = [];
      for (const [sid, p] of positions) {
        broadcast.push({ id: sid, x: p.x, y: p.y });
      }
      onLiveDrag(broadcast);
    },
    [onLiveDrag, throttledSetPointer]
  );

  const handleDragEnd = useCallback(
    (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
      const session = dragSessionRef.current;
      if (!session) return;

      const node = e.target;
      const stage = stageRef.current;

      // Commit final positions: read actual Konva node positions (one-time, not per-frame)
      const updates: Array<{ id: string; patch: Partial<Shape> }> = [];
      if (session.ids.length <= 1) {
        updates.push({ id, patch: { x: node.x(), y: node.y() } });
      } else if (stage) {
        for (const sid of session.ids) {
          const sNode = stage.findOne(`#${sid}`);
          if (sNode) {
            updates.push({ id: sid, patch: { x: sNode.x(), y: sNode.y() } });
          }
        }
      }

      if (updates.length <= 1 && updates.length > 0) {
        updateShape(updates[0].id, updates[0].patch);
      } else if (updates.length > 1) {
        updateShapes(updates);
      }

      // Clean up drag session
      dragSessionRef.current = null;
      dragPositionsRef.current.clear();
      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = 0;
      }
      setDragEpoch((e) => e + 1);
      useDebugStore.getState().setInteraction("idle");

      onLiveDragEnd?.();
    },
    [updateShape, updateShapes, onLiveDragEnd]
  );

  // (text editing functions moved to useTextEditing hook)

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

  // ── Connector endpoint handles for selected connectors ───────────
  const selectedConnectorEndpoints = useMemo(() => {
    if (selectedIds.length === 0) return [];
    const result: Array<{
      connectorId: string;
      end: "from" | "to";
      x: number;
      y: number;
    }> = [];
    for (const id of selectedIds) {
      const shape = shapesById.get(id);
      if (!shape || shape.type !== "connector") continue;
      const c = shape as ConnectorShape;

      // Resolve centers and bounds for both endpoints (O(1) lookups)
      let fromCx: number | null = null,
        fromCy: number | null = null,
        fromBounds: Bounds | null = null;
      if (c.fromId) {
        const fs = shapesById.get(c.fromId);
        if (fs) {
          fromBounds = getShapeBounds(fs);
          fromCx = fromBounds.x + fromBounds.width / 2;
          fromCy = fromBounds.y + fromBounds.height / 2;
        }
      } else if (c.fromPoint) {
        fromCx = c.fromPoint.x;
        fromCy = c.fromPoint.y;
      }

      let toCx: number | null = null,
        toCy: number | null = null,
        toBounds: Bounds | null = null;
      if (c.toId) {
        const ts = shapesById.get(c.toId);
        if (ts) {
          toBounds = getShapeBounds(ts);
          toCx = toBounds.x + toBounds.width / 2;
          toCy = toBounds.y + toBounds.height / 2;
        }
      } else if (c.toPoint) {
        toCx = c.toPoint.x;
        toCy = c.toPoint.y;
      }

      if (fromCx == null || fromCy == null || toCx == null || toCy == null) continue;

      // Compute edge intersection for connected shapes, raw point for freestanding
      const fromPt = fromBounds
        ? edgeIntersection(fromBounds, fromCx, fromCy, toCx, toCy)
        : { x: fromCx, y: fromCy };
      const toPt = toBounds
        ? edgeIntersection(toBounds, toCx, toCy, fromCx, fromCy)
        : { x: toCx, y: toCy };

      result.push({ connectorId: id, end: "from", x: fromPt.x, y: fromPt.y });
      result.push({ connectorId: id, end: "to", x: toPt.x, y: toPt.y });
    }
    return result;
  }, [selectedIds, shapesById]);

  const handleEndpointDragEnd = useCallback(
    (connectorId: string, end: "from" | "to", e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const dropX = node.x();
      const dropY = node.y();

      // Hit-test: find the shape under the drop point (excluding connectors)
      const hitShape = allShapesWithDrag.find((s) => {
        if (s.type === "connector" || s.id === connectorId) return false;
        const b = getShapeBounds(s);
        return dropX >= b.x && dropX <= b.x + b.width && dropY >= b.y && dropY <= b.y + b.height;
      });

      const store = useCanvasStore.getState();
      store.pushHistory();

      if (hitShape) {
        // Re-attach to shape — null out the freestanding point
        if (end === "from") {
          store.updateShape(connectorId, {
            fromId: hitShape.id,
            fromPoint: null,
          } as Partial<Shape>);
        } else {
          store.updateShape(connectorId, { toId: hitShape.id, toPoint: null } as Partial<Shape>);
        }
      } else {
        // Set as freestanding point — null out the shape reference
        if (end === "from") {
          store.updateShape(connectorId, {
            fromId: null,
            fromPoint: { x: dropX, y: dropY },
          } as Partial<Shape>);
        } else {
          store.updateShape(connectorId, {
            toId: null,
            toPoint: { x: dropX, y: dropY },
          } as Partial<Shape>);
        }
      }
    },
    [allShapesWithDrag]
  );

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden bg-[#ededed] dark:bg-[#1a1a1e]"
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
        {/* Dot grid layer — behind everything, not interactive */}
        <Layer listening={false}>
          <DotGrid
            viewport={gridViewport}
            stageWidth={stageSize.width}
            stageHeight={stageSize.height}
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
              isConnectorHover={activeTool === "connector" && connector.hoveredShapeId === shape.id}
              onSelect={handleShapeClick}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
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
          {selectedConnectorEndpoints.map((ep) => (
            <Circle
              key={`${ep.connectorId}-${ep.end}`}
              x={ep.x}
              y={ep.y}
              radius={6 / viewportScale}
              fill="#fff"
              stroke="#3b82f6"
              strokeWidth={2 / viewportScale}
              draggable
              perfectDrawEnabled={false}
              onDragMove={(e) => {
                setEndpointDrag({
                  connectorId: ep.connectorId,
                  end: ep.end,
                  x: e.target.x(),
                  y: e.target.y(),
                });
              }}
              onDragEnd={(e) => {
                setEndpointDrag(null);
                handleEndpointDragEnd(ep.connectorId, ep.end, e);
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

          {selectionBounds &&
            !textEditing.editingTextId &&
            interaction !== "dragging" &&
            !isTransforming &&
            // Hide when every selected shape is a connector (no meaningful dimensions)
            !selectedIds.every((id) => shapes.find((s) => s.id === id)?.type === "connector") && (
              <DimensionLabel bounds={selectionBounds} viewportScale={viewportScale} />
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
