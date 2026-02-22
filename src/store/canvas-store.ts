import { create } from "zustand";
import type {
  Shape,
  RectShape,
  CircleShape,
  TextShape,
  StickyNoteShape,
  FrameShape,
  ConnectorShape,
  BaseShape,
} from "@/lib/types";
import { generateId } from "@/lib/id";
import { getShapeBounds } from "@/lib/shape-geometry";

const MAX_HISTORY = 50;

interface HistoryEntry {
  shapes: Shape[];
}

interface ShapeUpdate {
  id: string;
  patch: Partial<Shape>;
}

interface CanvasStore {
  // ── State ──
  shapes: Shape[];
  selectedIds: string[];
  clipboard: Shape[];

  // ── History ──
  history: HistoryEntry[];
  historyIndex: number;

  // ── Sync ──
  /** Replace all shapes from Firestore snapshot (no history push). */
  setShapes: (shapes: Shape[]) => void;
  /** Add a shape without history push (used by sync layer). */
  addShape: (shape: Shape) => void;
  /** Remove a shape without history push (used by sync layer). */
  removeShapeSync: (id: string) => void;

  // ── Shape creation ──
  addRect: (centerX: number, centerY: number) => void;
  addCircle: (centerX: number, centerY: number) => void;
  addText: (centerX: number, centerY: number, text?: string) => string;
  addStickyNote: (centerX: number, centerY: number, text?: string, color?: string) => string;
  addFrame: (centerX: number, centerY: number, title?: string) => string;
  addFrameAtBounds: (x: number, y: number, w: number, h: number, title?: string) => string;
  addConnector: (
    from: { id: string } | { point: { x: number; y: number } },
    to: { id: string } | { point: { x: number; y: number } },
    style?: "line" | "arrow" | "double-arrow"
  ) => string;

  // ── Mutations ──
  updateShape: (id: string, patch: Partial<Shape>) => void;
  updateShapes: (updates: ShapeUpdate[]) => void;
  deleteShapes: (ids: string[]) => void;
  duplicateShapes: (ids: string[]) => void;

  // ── Selection ──
  setSelected: (ids: string[]) => void;
  toggleSelected: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;

  // ── Z-index ──
  bringToFront: (ids: string[]) => void;
  sendToBack: (ids: string[]) => void;

  // ── Clipboard ──
  copySelected: () => void;
  paste: (offsetX?: number, offsetY?: number) => void;

  // ── History ──
  canUndo: () => boolean;
  canRedo: () => boolean;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
}

function nextZIndex(shapes: Shape[]): number {
  if (shapes.length === 0) return 0;
  let max = shapes[0].zIndex;
  for (let i = 1; i < shapes.length; i++) {
    if (shapes[i].zIndex > max) max = shapes[i].zIndex;
  }
  return max + 1;
}

function baseProps(shapes: Shape[]): Pick<BaseShape, "rotation" | "opacity" | "zIndex"> {
  return { rotation: 0, opacity: 1, zIndex: nextZIndex(shapes) };
}

/** Find the smallest frame that fully contains the given bounds. */
function findParentFrame(
  shapes: Shape[],
  bx: number,
  by: number,
  bw: number,
  bh: number
): string | undefined {
  let best: FrameShape | undefined;
  const br = bx + bw;
  const bb = by + bh;
  for (const s of shapes) {
    if (s.type !== "frame") continue;
    if (bx >= s.x && by >= s.y && br <= s.x + s.w && bb <= s.y + s.h) {
      if (!best || s.w * s.h < best.w * best.h) best = s;
    }
  }
  return best?.id;
}

function remapConnectorRefs(shape: Shape, idMap: Map<string, string>): Shape {
  if (shape.type !== "connector") return shape;

  const next: ConnectorShape = { ...shape };
  if (next.fromId && idMap.has(next.fromId)) {
    next.fromId = idMap.get(next.fromId)!;
  }
  if (next.toId && idMap.has(next.toId)) {
    next.toId = idMap.get(next.toId)!;
  }
  return next;
}

function expandIdsWithInternalConnectors(shapes: Shape[], ids: string[]): Set<string> {
  const idSet = new Set(ids);
  for (const shape of shapes) {
    if (shape.type !== "connector" || idSet.has(shape.id)) continue;
    if (shape.fromId && shape.toId && idSet.has(shape.fromId) && idSet.has(shape.toId)) {
      idSet.add(shape.id);
    }
  }
  return idSet;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  shapes: [],
  selectedIds: [],
  clipboard: [],
  history: [],
  historyIndex: -1,

  // ── Sync ─────────────────────────────────────────────────────────

  setShapes: (shapes) => set({ shapes }),

  addShape: (shape) => set((s) => ({ shapes: [...s.shapes, shape] })),

  removeShapeSync: (id) =>
    set((s) => ({
      shapes: s.shapes.filter((shape) => shape.id !== id),
      selectedIds: s.selectedIds.filter((sid) => sid !== id),
    })),

  // ── Shape creation ────────────────────────────────────────────────

  addStickyNote: (centerX, centerY, text = "", color = "#fef08a") => {
    const state = get();
    state.pushHistory();
    const w = 200;
    const h = 200;
    const x = centerX - w / 2;
    const y = centerY - h / 2;
    const shape: StickyNoteShape = {
      id: generateId(),
      type: "sticky",
      x,
      y,
      w,
      h,
      text,
      color,
      fontSize: 16,
      ...baseProps(state.shapes),
      parentId: findParentFrame(state.shapes, x, y, w, h),
    };
    set({ shapes: [...state.shapes, shape], selectedIds: [shape.id] });
    return shape.id;
  },

  addFrame: (centerX, centerY, title = "Frame") => {
    const state = get();
    state.pushHistory();
    const w = 400;
    const h = 300;
    const shape: FrameShape = {
      id: generateId(),
      type: "frame",
      x: centerX - w / 2,
      y: centerY - h / 2,
      w,
      h,
      title,
      fill: "rgba(0,0,0,0.03)",
      stroke: "#a1a1aa",
      ...baseProps(state.shapes),
      zIndex: 0, // frames go behind everything
    };
    set({ shapes: [...state.shapes, shape], selectedIds: [shape.id] });
    return shape.id;
  },

  addRect: (centerX, centerY) => {
    const state = get();
    state.pushHistory();
    const w = 120;
    const h = 80;
    const x = centerX - w / 2;
    const y = centerY - h / 2;
    const shape: RectShape = {
      id: generateId(),
      type: "rect",
      x,
      y,
      w,
      h,
      fill: "#3b82f6",
      cornerRadius: 4,
      ...baseProps(state.shapes),
      parentId: findParentFrame(state.shapes, x, y, w, h),
    };
    set({ shapes: [...state.shapes, shape], selectedIds: [shape.id] });
  },

  addCircle: (centerX, centerY) => {
    const state = get();
    state.pushHistory();
    const radius = 45;
    const shape: CircleShape = {
      id: generateId(),
      type: "circle",
      x: centerX,
      y: centerY,
      radiusX: radius,
      radiusY: radius,
      fill: "#3b82f6",
      ...baseProps(state.shapes),
      parentId: findParentFrame(
        state.shapes,
        centerX - radius,
        centerY - radius,
        radius * 2,
        radius * 2
      ),
    };
    set({ shapes: [...state.shapes, shape], selectedIds: [shape.id] });
  },

  addText: (centerX, centerY, text = "Text") => {
    const state = get();
    state.pushHistory();
    const isDark =
      typeof document !== "undefined" && document.documentElement.classList.contains("dark");
    const x = centerX - 40;
    const y = centerY - 12;
    const w = 200;
    const h = 24; // approximate single-line height
    const shape: TextShape = {
      id: generateId(),
      type: "text",
      x,
      y,
      text,
      fontSize: 24,
      fontFamily: "sans-serif",
      fill: isDark ? "#fafafa" : "#18181b",
      width: w,
      align: "left",
      ...baseProps(state.shapes),
      parentId: findParentFrame(state.shapes, x, y, w, h),
    };
    set({ shapes: [...state.shapes, shape], selectedIds: [shape.id] });
    return shape.id;
  },

  addFrameAtBounds: (x, y, w, h, title = "Frame") => {
    const state = get();
    state.pushHistory();
    const frameId = generateId();
    const shape: FrameShape = {
      id: frameId,
      type: "frame",
      x,
      y,
      w,
      h,
      title,
      fill: "rgba(0,0,0,0.03)",
      stroke: "#a1a1aa",
      ...baseProps(state.shapes),
      zIndex: 0,
    };

    // Auto-contain: assign parentId to shapes fully inside the frame bounds
    const frameRight = x + w;
    const frameBottom = y + h;
    const updatedShapes = state.shapes.map((s) => {
      if (s.type === "connector" || s.parentId) return s;
      const b = getShapeBounds(s);
      if (b.x >= x && b.y >= y && b.x + b.width <= frameRight && b.y + b.height <= frameBottom) {
        return { ...s, parentId: frameId } as Shape;
      }
      return s;
    });

    set({ shapes: [...updatedShapes, shape], selectedIds: [frameId] });
    return frameId;
  },

  addConnector: (from, to, style = "arrow") => {
    const state = get();
    state.pushHistory();
    const shape: ConnectorShape = {
      id: generateId(),
      type: "connector",
      x: 0,
      y: 0,
      ...("id" in from ? { fromId: from.id } : { fromPoint: from.point }),
      ...("id" in to ? { toId: to.id } : { toPoint: to.point }),
      style,
      stroke: "#6b7280",
      strokeWidth: 2,
      ...baseProps(state.shapes),
    };
    set({ shapes: [...state.shapes, shape], selectedIds: [shape.id] });
    return shape.id;
  },

  // ── Mutations ─────────────────────────────────────────────────────

  updateShape: (id, patch) => get().updateShapes([{ id, patch }]),

  updateShapes: (updates) => {
    if (updates.length === 0) return;
    const patchMap = new Map(updates.map((update) => [update.id, update.patch]));
    set((s) => ({
      shapes: s.shapes.map((shape) => {
        const patch = patchMap.get(shape.id);
        return patch ? ({ ...shape, ...patch } as Shape) : shape;
      }),
    }));
  },

  deleteShapes: (ids) => {
    const state = get();
    if (ids.length === 0) return;
    state.pushHistory();
    const idSet = new Set(ids);
    // Also delete connectors that reference any deleted shape
    const orphanedConnectors = state.shapes.filter(
      (s) =>
        s.type === "connector" &&
        !idSet.has(s.id) &&
        ((s.fromId && idSet.has(s.fromId)) || (s.toId && idSet.has(s.toId)))
    );
    for (const c of orphanedConnectors) idSet.add(c.id);
    set({
      // Remove deleted shapes; clear parentId on children of deleted frames
      shapes: state.shapes
        .filter((s) => !idSet.has(s.id))
        .map((s) =>
          s.parentId && idSet.has(s.parentId) ? ({ ...s, parentId: undefined } as Shape) : s
        ),
      selectedIds: state.selectedIds.filter((id) => !idSet.has(id)),
    });
  },

  duplicateShapes: (ids) => {
    const state = get();
    if (ids.length === 0) return;
    state.pushHistory();
    const idsToCopy = expandIdsWithInternalConnectors(state.shapes, ids);
    const originals = state.shapes.filter((s) => idsToCopy.has(s.id));
    const idMap = new Map<string, string>();
    for (const shape of originals) {
      idMap.set(shape.id, generateId());
    }
    const copies = originals.map((shape, i) => {
      const copied = {
        ...shape,
        id: idMap.get(shape.id)!,
        x: shape.x + 20,
        y: shape.y + 20,
        zIndex: nextZIndex(state.shapes) + i,
      } as Shape;
      return remapConnectorRefs(copied, idMap);
    });
    set({
      shapes: [...state.shapes, ...copies],
      selectedIds: copies.map((c) => c.id),
    });
  },

  // ── Selection ─────────────────────────────────────────────────────

  setSelected: (ids) => set({ selectedIds: ids }),

  toggleSelected: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((i) => i !== id)
        : [...s.selectedIds, id],
    })),

  selectAll: () => set((s) => ({ selectedIds: s.shapes.map((sh) => sh.id) })),

  clearSelection: () => set({ selectedIds: [] }),

  // ── Z-index ───────────────────────────────────────────────────────

  bringToFront: (ids) => {
    const state = get();
    if (ids.length === 0) return;
    state.pushHistory();
    let maxZ = nextZIndex(state.shapes);
    set({
      shapes: state.shapes.map((s) => (ids.includes(s.id) ? { ...s, zIndex: maxZ++ } : s)),
    });
  },

  sendToBack: (ids) => {
    const state = get();
    if (ids.length === 0) return;
    state.pushHistory();
    const minZ = Math.min(...state.shapes.map((s) => s.zIndex));
    let z = minZ - ids.length;
    set({
      shapes: state.shapes.map((s) => (ids.includes(s.id) ? { ...s, zIndex: z++ } : s)),
    });
  },

  // ── Clipboard ─────────────────────────────────────────────────────

  copySelected: () => {
    const state = get();
    const idsToCopy = expandIdsWithInternalConnectors(state.shapes, state.selectedIds);
    const copied = state.shapes.filter((s) => idsToCopy.has(s.id));
    set({ clipboard: copied });
  },

  paste: (offsetX = 20, offsetY = 20) => {
    const state = get();
    if (state.clipboard.length === 0) return;
    state.pushHistory();
    const idMap = new Map<string, string>();
    for (const shape of state.clipboard) {
      idMap.set(shape.id, generateId());
    }
    const pasted = state.clipboard.map((shape, i) => {
      const copied = {
        ...shape,
        id: idMap.get(shape.id)!,
        x: shape.x + offsetX,
        y: shape.y + offsetY,
        zIndex: nextZIndex(state.shapes) + i,
      } as Shape;
      return remapConnectorRefs(copied, idMap);
    });
    set({
      shapes: [...state.shapes, ...pasted],
      selectedIds: pasted.map((p) => p.id),
    });
  },

  // ── History ───────────────────────────────────────────────────────

  canUndo: () => get().historyIndex >= 0,
  canRedo: () => get().historyIndex < get().history.length - 2,

  // History model:
  // pushHistory() saves a snapshot of current shapes BEFORE a mutation.
  // history = [snap0, snap1, snap2, ...], historyIndex points at the last saved snapshot.
  // Undo restores the snapshot at historyIndex, then decrements.
  // But first undo also saves the CURRENT state so redo can get back to it.
  //
  // Example: start empty, add rect A, add rect B
  //   push → history=[[]],        idx=0, then set shapes=[A]
  //   push → history=[[], [A]],   idx=1, then set shapes=[A,B]
  //   undo → save current [A,B] as future, restore [A], idx=0
  //   undo → restore [], idx=-1
  //   redo → restore [A], idx=0
  //   redo → restore [A,B], idx=1

  pushHistory: () => {
    const state = get();
    const trimmed = state.history.slice(0, state.historyIndex + 1);
    const entry: HistoryEntry = { shapes: state.shapes.map((s) => ({ ...s })) };
    const newHistory = [...trimmed, entry].slice(-MAX_HISTORY);
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: () => {
    const state = get();
    if (state.historyIndex < 0) return;

    // On first undo from tip, append current state so redo can restore it
    let history = state.history;
    if (state.historyIndex === history.length - 1) {
      const current: HistoryEntry = {
        shapes: state.shapes.map((s) => ({ ...s })),
      };
      history = [...history, current];
    }

    const entry = history[state.historyIndex];
    set({
      shapes: entry.shapes,
      selectedIds: [],
      history,
      historyIndex: state.historyIndex - 1,
    });
  },

  redo: () => {
    const state = get();
    if (state.historyIndex >= state.history.length - 2) return;
    // Move forward: the state to restore is at historyIndex + 2
    // (historyIndex + 1 is the snapshot taken BEFORE that mutation,
    //  historyIndex + 2 is either the next snapshot or the saved current)
    const nextIdx = state.historyIndex + 1;
    const entry = state.history[nextIdx + 1];
    if (entry) {
      set({
        shapes: entry.shapes,
        selectedIds: [],
        historyIndex: nextIdx,
      });
    }
  },
}));
