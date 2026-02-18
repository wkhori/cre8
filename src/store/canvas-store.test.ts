import { beforeEach, describe, expect, it } from "vitest";
import type { Shape } from "@/lib/types";
import { useCanvasStore } from "@/store/canvas-store";

function resetCanvasStore() {
  useCanvasStore.setState({
    shapes: [],
    selectedIds: [],
    clipboard: [],
    history: [],
    historyIndex: -1,
  });
}

function shapeSnapshot(shape: Shape) {
  if (shape.type === "rect") {
    return {
      id: shape.id,
      type: shape.type,
      x: shape.x,
      y: shape.y,
      w: shape.w,
      h: shape.h,
      zIndex: shape.zIndex,
    };
  }

  if (shape.type === "circle") {
    return {
      id: shape.id,
      type: shape.type,
      x: shape.x,
      y: shape.y,
      radiusX: shape.radiusX,
      radiusY: shape.radiusY,
      zIndex: shape.zIndex,
    };
  }

  if (shape.type === "text") {
    return {
      id: shape.id,
      type: shape.type,
      x: shape.x,
      y: shape.y,
      text: shape.text,
      width: shape.width,
      fontSize: shape.fontSize,
      zIndex: shape.zIndex,
    };
  }

  if (shape.type === "line") {
    return {
      id: shape.id,
      type: shape.type,
      x: shape.x,
      y: shape.y,
      points: shape.points,
      zIndex: shape.zIndex,
    };
  }

  // sticky, frame, connector, or any future type
  return {
    id: shape.id,
    type: shape.type,
    x: shape.x,
    y: shape.y,
    zIndex: shape.zIndex,
  };
}

function canvasSnapshot() {
  return useCanvasStore.getState().shapes.map(shapeSnapshot);
}

describe("canvas-store", () => {
  beforeEach(() => {
    resetCanvasStore();
  });

  it("supports selection and clipboard workflows", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    store.addCircle(200, 200);
    store.addText(300, 300, "A");

    const [rect, circle, text] = useCanvasStore.getState().shapes;
    expect(useCanvasStore.getState().selectedIds).toEqual([text.id]);

    store.setSelected([rect.id]);
    store.toggleSelected(circle.id);
    expect(useCanvasStore.getState().selectedIds).toEqual([rect.id, circle.id]);

    store.selectAll();
    expect(useCanvasStore.getState().selectedIds).toHaveLength(3);

    store.clearSelection();
    expect(useCanvasStore.getState().selectedIds).toEqual([]);

    store.setSelected([rect.id]);
    store.copySelected();
    store.paste(10, 15);

    const state = useCanvasStore.getState();
    const pasted = state.shapes.find(
      (s) => s.id !== rect.id && s.type === "rect" && s.x === rect.x + 10 && s.y === rect.y + 15
    );

    expect(pasted).toBeDefined();
    expect(state.selectedIds).toEqual([pasted!.id]);
  });

  it("replays undo/redo in exact order across all mutating actions", () => {
    const store = useCanvasStore.getState();
    const snapshots: ReturnType<typeof canvasSnapshot>[] = [];
    const capture = () => snapshots.push(canvasSnapshot());

    capture(); // initial

    store.addRect(80, 90);
    capture();
    const rectId = useCanvasStore.getState().shapes[0]!.id;

    store.addCircle(220, 140);
    capture();
    const circleId = useCanvasStore.getState().shapes.find((s) => s.type === "circle")!.id;

    store.addText(300, 200, "Note");
    capture();

    store.duplicateShapes([rectId]);
    capture();

    store.copySelected();
    store.paste(7, 9);
    capture();

    store.bringToFront([rectId]);
    capture();

    store.sendToBack([rectId]);
    capture();

    store.pushHistory();
    store.updateShape(rectId, { x: 777, y: 888 });
    capture();

    store.deleteShapes([circleId]);
    capture();

    const totalMutations = snapshots.length - 1;
    expect(useCanvasStore.getState().historyIndex).toBe(totalMutations - 1);

    for (let i = snapshots.length - 2; i >= 0; i--) {
      store.undo();
      expect(canvasSnapshot()).toEqual(snapshots[i]);
      expect(useCanvasStore.getState().selectedIds).toEqual([]);
    }

    for (let i = 1; i < snapshots.length; i++) {
      store.redo();
      expect(canvasSnapshot()).toEqual(snapshots[i]);
      expect(useCanvasStore.getState().selectedIds).toEqual([]);
    }
  });

  it("drops redo branch after new mutation post-undo", () => {
    const store = useCanvasStore.getState();
    store.addRect(50, 50);
    store.addCircle(150, 150);
    const beforeUndo = canvasSnapshot();

    store.undo();
    const afterUndo = canvasSnapshot();
    expect(afterUndo).not.toEqual(beforeUndo);

    store.addText(250, 250, "new branch");
    const afterNewBranch = canvasSnapshot();

    store.redo();
    expect(canvasSnapshot()).toEqual(afterNewBranch);
  });

  // ── Sticky note creation ──────────────────────────────────────────
  it("addStickyNote creates with correct defaults", () => {
    const store = useCanvasStore.getState();
    const id = store.addStickyNote(300, 200);

    const state = useCanvasStore.getState();
    const sticky = state.shapes.find((s) => s.id === id);
    expect(sticky).toBeDefined();
    expect(sticky!.type).toBe("sticky");
    if (sticky!.type !== "sticky") throw new Error("unreachable");

    // Centered at (300, 200) with 200x200 default size
    expect(sticky!.w).toBe(200);
    expect(sticky!.h).toBe(200);
    expect(sticky!.x).toBe(200); // 300 - 100
    expect(sticky!.y).toBe(100); // 200 - 100
    expect(sticky!.text).toBe("");
    expect(sticky!.color).toBe("#fef08a");
    expect(sticky!.fontSize).toBe(16);
    // Auto-selected
    expect(state.selectedIds).toEqual([id]);
  });

  it("addStickyNote accepts custom text and color", () => {
    const store = useCanvasStore.getState();
    const id = store.addStickyNote(0, 0, "Hello", "#a7f3d0");

    const sticky = useCanvasStore.getState().shapes.find((s) => s.id === id);
    expect(sticky).toBeDefined();
    if (sticky!.type !== "sticky") throw new Error("unreachable");
    expect(sticky!.text).toBe("Hello");
    expect(sticky!.color).toBe("#a7f3d0");
  });

  // ── Frame creation ──────────────────────────────────────────────
  it("addFrame creates with correct defaults", () => {
    const store = useCanvasStore.getState();
    const id = store.addFrame(400, 300);

    const state = useCanvasStore.getState();
    const frame = state.shapes.find((s) => s.id === id);
    expect(frame).toBeDefined();
    expect(frame!.type).toBe("frame");
    if (frame!.type !== "frame") throw new Error("unreachable");

    // Centered at (400, 300) with 400x300 default size
    expect(frame!.w).toBe(400);
    expect(frame!.h).toBe(300);
    expect(frame!.x).toBe(200); // 400 - 200
    expect(frame!.y).toBe(150); // 300 - 150
    expect(frame!.title).toBe("Frame");
    expect(frame!.zIndex).toBe(0); // frames go behind everything
    expect(state.selectedIds).toEqual([id]);
  });

  // ── Connector creation ──────────────────────────────────────────
  it("addConnector creates shape-to-shape connector", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    store.addCircle(300, 300);
    const [rect, circle] = useCanvasStore.getState().shapes;

    const connId = store.addConnector({ id: rect.id }, { id: circle.id }, "arrow");
    const conn = useCanvasStore.getState().shapes.find((s) => s.id === connId);
    expect(conn).toBeDefined();
    expect(conn!.type).toBe("connector");
    if (conn!.type !== "connector") throw new Error("unreachable");
    expect(conn!.fromId).toBe(rect.id);
    expect(conn!.toId).toBe(circle.id);
    expect(conn!.style).toBe("arrow");
  });

  it("addConnector creates point-to-point connector", () => {
    const store = useCanvasStore.getState();
    const connId = store.addConnector(
      { point: { x: 10, y: 20 } },
      { point: { x: 200, y: 300 } },
      "line"
    );
    const conn = useCanvasStore.getState().shapes.find((s) => s.id === connId);
    expect(conn).toBeDefined();
    if (conn!.type !== "connector") throw new Error("unreachable");
    expect(conn!.fromPoint).toEqual({ x: 10, y: 20 });
    expect(conn!.toPoint).toEqual({ x: 200, y: 300 });
    expect(conn!.style).toBe("line");
  });

  it("addConnector creates shape-to-point connector", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    const [rect] = useCanvasStore.getState().shapes;

    const connId = store.addConnector({ id: rect.id }, { point: { x: 500, y: 500 } }, "arrow");
    const conn = useCanvasStore.getState().shapes.find((s) => s.id === connId);
    expect(conn).toBeDefined();
    if (conn!.type !== "connector") throw new Error("unreachable");
    expect(conn!.fromId).toBe(rect.id);
    expect(conn!.toPoint).toEqual({ x: 500, y: 500 });
  });

  // ── Connector cascade delete ─────────────────────────────────────
  it("deleteShapes cascades to orphaned connectors", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    store.addCircle(300, 300);
    const [rect, circle] = useCanvasStore.getState().shapes;

    store.addConnector({ id: rect.id }, { id: circle.id }, "arrow");
    expect(useCanvasStore.getState().shapes).toHaveLength(3);

    // Delete the rect — connector should be cascade-deleted too
    store.deleteShapes([rect.id]);
    const remaining = useCanvasStore.getState().shapes;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(circle.id);
  });

  // ── Update sticky/frame fields ──────────────────────────────────
  it("updateShape modifies sticky text", () => {
    const store = useCanvasStore.getState();
    const id = store.addStickyNote(100, 100, "original");
    store.pushHistory();
    store.updateShape(id, { text: "updated" });

    const sticky = useCanvasStore.getState().shapes.find((s) => s.id === id);
    if (sticky!.type !== "sticky") throw new Error("unreachable");
    expect(sticky!.text).toBe("updated");
  });

  it("updateShape modifies frame title", () => {
    const store = useCanvasStore.getState();
    const id = store.addFrame(100, 100, "Original");
    store.pushHistory();
    store.updateShape(id, { title: "Renamed" });

    const frame = useCanvasStore.getState().shapes.find((s) => s.id === id);
    if (frame!.type !== "frame") throw new Error("unreachable");
    expect(frame!.title).toBe("Renamed");
  });

  // ── Existing tests ──────────────────────────────────────────────
  it("caps history at 50 entries", () => {
    const store = useCanvasStore.getState();
    for (let i = 0; i < 60; i++) {
      store.addRect(20 + i * 5, 20 + i * 3);
    }

    const stateAfterAdds = useCanvasStore.getState();
    expect(stateAfterAdds.history).toHaveLength(50);
    expect(stateAfterAdds.historyIndex).toBe(49);

    for (let i = 0; i < 50; i++) {
      store.undo();
    }

    // Earliest 10 snapshots were trimmed, so undo floor is 10 remaining shapes.
    expect(useCanvasStore.getState().shapes).toHaveLength(10);
    expect(useCanvasStore.getState().historyIndex).toBe(-1);
  });
});
