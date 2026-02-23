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

  it("duplicateShapes includes internal connector and remaps refs", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    store.addCircle(300, 300);
    const [rect, circle] = useCanvasStore.getState().shapes;
    const connId = store.addConnector({ id: rect.id }, { id: circle.id }, "arrow");

    // Duplicate only endpoint shapes; connector should be pulled in automatically.
    store.duplicateShapes([rect.id, circle.id]);

    const shapes = useCanvasStore.getState().shapes;
    const duplicatedRect = shapes.find(
      (s) => s.type === "rect" && s.id !== rect.id && s.x === rect.x + 20 && s.y === rect.y + 20
    );
    const duplicatedCircle = shapes.find(
      (s) =>
        s.type === "circle" && s.id !== circle.id && s.x === circle.x + 20 && s.y === circle.y + 20
    );
    const duplicatedConn = shapes.find((s) => s.type === "connector" && s.id !== connId);

    expect(duplicatedRect).toBeDefined();
    expect(duplicatedCircle).toBeDefined();
    expect(duplicatedConn).toBeDefined();
    if (!duplicatedRect || !duplicatedCircle || !duplicatedConn) throw new Error("unreachable");
    if (duplicatedConn.type !== "connector") throw new Error("unreachable");

    expect(duplicatedConn.fromId).toBe(duplicatedRect.id);
    expect(duplicatedConn.toId).toBe(duplicatedCircle.id);
  });

  it("copy/paste includes internal connector and remaps refs", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    store.addCircle(300, 300);
    const [rect, circle] = useCanvasStore.getState().shapes;
    const connId = store.addConnector({ id: rect.id }, { id: circle.id }, "arrow");

    // Copy only endpoint shapes; connector should be pulled in automatically.
    store.setSelected([rect.id, circle.id]);
    store.copySelected();
    store.paste(30, 40);

    const shapes = useCanvasStore.getState().shapes;
    const pastedRect = shapes.find(
      (s) => s.type === "rect" && s.id !== rect.id && s.x === rect.x + 30 && s.y === rect.y + 40
    );
    const pastedCircle = shapes.find(
      (s) =>
        s.type === "circle" && s.id !== circle.id && s.x === circle.x + 30 && s.y === circle.y + 40
    );
    const pastedConn = shapes.find((s) => s.type === "connector" && s.id !== connId);

    expect(pastedRect).toBeDefined();
    expect(pastedCircle).toBeDefined();
    expect(pastedConn).toBeDefined();
    if (!pastedRect || !pastedCircle || !pastedConn) throw new Error("unreachable");
    if (pastedConn.type !== "connector") throw new Error("unreachable");

    expect(pastedConn.fromId).toBe(pastedRect.id);
    expect(pastedConn.toId).toBe(pastedCircle.id);
  });

  it("paste translates free-point connectors via x/y while preserving local endpoints", () => {
    const store = useCanvasStore.getState();
    const connId = store.addConnector(
      { point: { x: 10, y: 20 } },
      { point: { x: 200, y: 300 } },
      "line"
    );
    store.setSelected([connId]);
    store.copySelected();
    store.paste(15, 25);

    const pastedConn = useCanvasStore
      .getState()
      .shapes.find((s) => s.type === "connector" && s.id !== connId);
    expect(pastedConn).toBeDefined();
    if (!pastedConn || pastedConn.type !== "connector") throw new Error("unreachable");
    expect(pastedConn.x).toBe(15);
    expect(pastedConn.y).toBe(25);
    expect(pastedConn.fromPoint).toEqual({ x: 10, y: 20 });
    expect(pastedConn.toPoint).toEqual({ x: 200, y: 300 });
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

  // ── Undo/redo edge cases ───────────────────────────────────────

  it("undo on empty history is a no-op", () => {
    const store = useCanvasStore.getState();
    expect(store.canUndo()).toBe(false);
    store.undo();
    expect(useCanvasStore.getState().shapes).toEqual([]);
    expect(useCanvasStore.getState().historyIndex).toBe(-1);
  });

  it("redo on empty history is a no-op", () => {
    const store = useCanvasStore.getState();
    expect(store.canRedo()).toBe(false);
    store.redo();
    expect(useCanvasStore.getState().shapes).toEqual([]);
    expect(useCanvasStore.getState().historyIndex).toBe(-1);
  });

  it("redo past the end is a no-op", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    // No undo was done, so redo should not advance
    expect(store.canRedo()).toBe(false);
    const before = canvasSnapshot();
    store.redo();
    expect(canvasSnapshot()).toEqual(before);
  });

  it("undo past the beginning is a no-op", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    store.undo(); // back to empty
    expect(useCanvasStore.getState().historyIndex).toBe(-1);
    expect(useCanvasStore.getState().shapes).toEqual([]);
    // Try another undo — should be no-op
    store.undo();
    expect(useCanvasStore.getState().historyIndex).toBe(-1);
    expect(useCanvasStore.getState().shapes).toEqual([]);
  });

  it("canUndo / canRedo reflect state correctly", () => {
    const store = useCanvasStore.getState();
    expect(store.canUndo()).toBe(false);
    expect(store.canRedo()).toBe(false);

    store.addRect(100, 100);
    expect(useCanvasStore.getState().canUndo()).toBe(true);
    expect(useCanvasStore.getState().canRedo()).toBe(false);

    store.addCircle(200, 200);
    expect(useCanvasStore.getState().canUndo()).toBe(true);
    expect(useCanvasStore.getState().canRedo()).toBe(false);

    store.undo(); // back to [rect]
    expect(useCanvasStore.getState().canUndo()).toBe(true);
    expect(useCanvasStore.getState().canRedo()).toBe(true);

    store.undo(); // back to []
    expect(useCanvasStore.getState().canUndo()).toBe(false);
    expect(useCanvasStore.getState().canRedo()).toBe(true);

    store.redo(); // forward to [rect]
    expect(useCanvasStore.getState().canUndo()).toBe(true);
    expect(useCanvasStore.getState().canRedo()).toBe(true);

    store.redo(); // forward to [rect, circle]
    expect(useCanvasStore.getState().canUndo()).toBe(true);
    expect(useCanvasStore.getState().canRedo()).toBe(false);
  });

  it("undo addStickyNote restores empty canvas", () => {
    const store = useCanvasStore.getState();
    store.addStickyNote(100, 100, "Hello");
    expect(useCanvasStore.getState().shapes).toHaveLength(1);

    store.undo();
    expect(useCanvasStore.getState().shapes).toHaveLength(0);

    store.redo();
    expect(useCanvasStore.getState().shapes).toHaveLength(1);
    const sticky = useCanvasStore.getState().shapes[0];
    if (sticky.type !== "sticky") throw new Error("unreachable");
    expect(sticky.text).toBe("Hello");
  });

  it("undo addFrame restores empty canvas", () => {
    const store = useCanvasStore.getState();
    store.addFrame(200, 200, "My Frame");
    expect(useCanvasStore.getState().shapes).toHaveLength(1);

    store.undo();
    expect(useCanvasStore.getState().shapes).toHaveLength(0);

    store.redo();
    const frame = useCanvasStore.getState().shapes[0];
    if (frame.type !== "frame") throw new Error("unreachable");
    expect(frame.title).toBe("My Frame");
  });

  it("undo addConnector restores previous shapes", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    store.addCircle(300, 300);
    const beforeConnector = canvasSnapshot();

    store.addConnector(
      { id: useCanvasStore.getState().shapes[0].id },
      { id: useCanvasStore.getState().shapes[1].id },
      "arrow"
    );
    expect(useCanvasStore.getState().shapes).toHaveLength(3);

    store.undo();
    expect(canvasSnapshot()).toEqual(beforeConnector);
    expect(useCanvasStore.getState().shapes).toHaveLength(2);
  });

  it("undo deleteShapes restores deleted shapes", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    store.addCircle(200, 200);
    const beforeDelete = canvasSnapshot();

    const rectId = useCanvasStore.getState().shapes[0].id;
    store.deleteShapes([rectId]);
    expect(useCanvasStore.getState().shapes).toHaveLength(1);

    store.undo();
    expect(canvasSnapshot()).toEqual(beforeDelete);
  });

  it("undo deleteShapes restores cascaded connectors", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    store.addCircle(300, 300);
    const [rect, circle] = useCanvasStore.getState().shapes;
    store.addConnector({ id: rect.id }, { id: circle.id }, "arrow");
    const beforeDelete = canvasSnapshot();

    // Deleting rect cascades to connector
    store.deleteShapes([rect.id]);
    expect(useCanvasStore.getState().shapes).toHaveLength(1);

    store.undo();
    expect(canvasSnapshot()).toEqual(beforeDelete);
    expect(useCanvasStore.getState().shapes).toHaveLength(3);
  });

  it("undo duplicateShapes removes the duplicates", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    const beforeDup = canvasSnapshot();

    const rectId = useCanvasStore.getState().shapes[0].id;
    store.duplicateShapes([rectId]);
    expect(useCanvasStore.getState().shapes).toHaveLength(2);

    store.undo();
    expect(canvasSnapshot()).toEqual(beforeDup);
    expect(useCanvasStore.getState().shapes).toHaveLength(1);
  });

  it("undo paste removes pasted shapes", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    store.setSelected([useCanvasStore.getState().shapes[0].id]);
    store.copySelected();
    const beforePaste = canvasSnapshot();

    store.paste(20, 20);
    expect(useCanvasStore.getState().shapes).toHaveLength(2);

    store.undo();
    expect(canvasSnapshot()).toEqual(beforePaste);
  });

  it("undo bringToFront restores original z-order", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    store.addCircle(200, 200);
    const beforeBring = canvasSnapshot();

    const rectId = useCanvasStore.getState().shapes[0].id;
    store.bringToFront([rectId]);
    expect(canvasSnapshot()).not.toEqual(beforeBring);

    store.undo();
    expect(canvasSnapshot()).toEqual(beforeBring);
  });

  it("undo sendToBack restores original z-order", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    store.addCircle(200, 200);
    const beforeSend = canvasSnapshot();

    const circleId = useCanvasStore.getState().shapes[1].id;
    store.sendToBack([circleId]);
    expect(canvasSnapshot()).not.toEqual(beforeSend);

    store.undo();
    expect(canvasSnapshot()).toEqual(beforeSend);
  });

  it("undo updateShape restores previous values", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    const rectId = useCanvasStore.getState().shapes[0].id;
    const beforeUpdate = canvasSnapshot();

    store.pushHistory();
    store.updateShape(rectId, { x: 999, y: 888 });
    expect(useCanvasStore.getState().shapes[0].x).toBe(999);

    store.undo();
    expect(canvasSnapshot()).toEqual(beforeUpdate);
  });

  it("undo color change (pushHistory + updateShapes) restores original color", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    const rectId = useCanvasStore.getState().shapes[0].id;
    const originalColor = (useCanvasStore.getState().shapes[0] as { fill: string }).fill;

    store.pushHistory();
    store.updateShapes([{ id: rectId, patch: { fill: "#ff0000" } }]);
    expect((useCanvasStore.getState().shapes[0] as { fill: string }).fill).toBe("#ff0000");

    store.undo();
    expect((useCanvasStore.getState().shapes[0] as { fill: string }).fill).toBe(originalColor);
  });

  it("text editing undo flow: pushHistory before edits, undo restores original", () => {
    const store = useCanvasStore.getState();
    const id = store.addStickyNote(100, 100, "original text");

    // Simulate beginTextEditing: pushHistory BEFORE any live edits
    store.pushHistory();

    // Simulate handleTextareaChange: live edits go directly to store
    store.updateShape(id, { text: "typing..." });
    store.updateShape(id, { text: "typing more..." });
    store.updateShape(id, { text: "final edit" });

    // Simulate commitTextEdit: just updates with final value (no extra pushHistory)
    store.updateShape(id, { text: "final edit" });

    const sticky = useCanvasStore.getState().shapes.find((s) => s.id === id);
    if (sticky!.type !== "sticky") throw new Error("unreachable");
    expect(sticky!.text).toBe("final edit");

    // Undo should restore the original text (snapshot was taken before live edits)
    store.undo();
    const restored = useCanvasStore.getState().shapes.find((s) => s.id === id);
    if (restored!.type !== "sticky") throw new Error("unreachable");
    expect(restored!.text).toBe("original text");
  });

  it("text editing cancel (undo) restores original text", () => {
    const store = useCanvasStore.getState();
    const id = store.addStickyNote(100, 100, "keep me");

    // Simulate beginTextEditing
    store.pushHistory();

    // Simulate live typing
    store.updateShape(id, { text: "changed" });

    // Simulate cancelTextEdit: undo reverts to pre-edit state
    store.undo();
    const restored = useCanvasStore.getState().shapes.find((s) => s.id === id);
    if (restored!.type !== "sticky") throw new Error("unreachable");
    expect(restored!.text).toBe("keep me");
  });

  it("frame title editing undo restores original title", () => {
    const store = useCanvasStore.getState();
    const id = store.addFrame(200, 200, "Original Title");

    // Simulate beginTextEditing
    store.pushHistory();

    // Simulate live typing
    store.updateShape(id, { title: "New Title" });

    // Simulate commitTextEdit (no extra push)
    store.updateShape(id, { title: "New Title" });

    const frame = useCanvasStore.getState().shapes.find((s) => s.id === id);
    if (frame!.type !== "frame") throw new Error("unreachable");
    expect(frame!.title).toBe("New Title");

    store.undo();
    const restored = useCanvasStore.getState().shapes.find((s) => s.id === id);
    if (restored!.type !== "frame") throw new Error("unreachable");
    expect(restored!.title).toBe("Original Title");
  });

  it("nudge sequence: single pushHistory covers multiple arrow moves", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    const rectId = useCanvasStore.getState().shapes[0].id;
    const originalX = useCanvasStore.getState().shapes[0].x;

    // Simulate nudge sequence: push once, then multiple updateShapes
    store.pushHistory();
    store.updateShapes([{ id: rectId, patch: { x: originalX + 1 } }]);
    store.updateShapes([{ id: rectId, patch: { x: originalX + 2 } }]);
    store.updateShapes([{ id: rectId, patch: { x: originalX + 3 } }]);

    expect(useCanvasStore.getState().shapes[0].x).toBe(originalX + 3);

    // Single undo should revert the entire nudge sequence
    store.undo();
    expect(useCanvasStore.getState().shapes[0].x).toBe(originalX);
  });

  it("multiple undo then redo preserves exact shape data", () => {
    const store = useCanvasStore.getState();
    store.addStickyNote(100, 100, "sticky");
    store.addFrame(300, 300, "frame");
    store.addConnector(
      { id: useCanvasStore.getState().shapes[0].id },
      { id: useCanvasStore.getState().shapes[1].id },
      "arrow"
    );
    const finalSnapshot = canvasSnapshot();

    // Undo all 3
    store.undo();
    store.undo();
    store.undo();
    expect(useCanvasStore.getState().shapes).toHaveLength(0);

    // Redo all 3
    store.redo();
    store.redo();
    store.redo();
    expect(canvasSnapshot()).toEqual(finalSnapshot);
  });

  it("undo clears selection", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    const rectId = useCanvasStore.getState().shapes[0].id;
    // addRect auto-selects
    expect(useCanvasStore.getState().selectedIds).toEqual([rectId]);

    store.undo();
    expect(useCanvasStore.getState().selectedIds).toEqual([]);
  });

  it("redo clears selection", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    store.undo();
    store.setSelected([]); // just ensure clean state
    store.redo();
    // Redo should clear selection
    expect(useCanvasStore.getState().selectedIds).toEqual([]);
  });

  it("addFrameAtBounds is undoable and restores child parentIds", () => {
    const store = useCanvasStore.getState();
    // Add a rect that will be inside the frame bounds
    store.addRect(150, 150);
    const rectId = useCanvasStore.getState().shapes[0].id;
    const beforeFrame = canvasSnapshot();

    // Frame will encompass the rect
    store.addFrameAtBounds(0, 0, 500, 500, "Container");
    const rect = useCanvasStore.getState().shapes.find((s) => s.id === rectId);
    expect(rect?.parentId).toBeDefined(); // rect adopted by frame

    store.undo();
    expect(canvasSnapshot()).toEqual(beforeFrame);
    const restoredRect = useCanvasStore.getState().shapes.find((s) => s.id === rectId);
    expect(restoredRect?.parentId).toBeUndefined();
  });

  it("setShapes (sync) does NOT push history", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    const historyLenBefore = useCanvasStore.getState().history.length;

    // setShapes is for Firestore sync — should NOT affect history
    store.setShapes([]);
    expect(useCanvasStore.getState().history.length).toBe(historyLenBefore);
  });

  it("addShape (sync) does NOT push history", () => {
    const store = useCanvasStore.getState();
    const historyLenBefore = useCanvasStore.getState().history.length;

    store.addShape({
      id: "sync-1",
      type: "rect",
      x: 0,
      y: 0,
      w: 50,
      h: 50,
      fill: "#000",
      cornerRadius: 0,
      rotation: 0,
      opacity: 1,
      zIndex: 0,
    });
    expect(useCanvasStore.getState().history.length).toBe(historyLenBefore);
  });

  it("removeShapeSync does NOT push history", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    const rectId = useCanvasStore.getState().shapes[0].id;
    const historyLenBefore = useCanvasStore.getState().history.length;

    store.removeShapeSync(rectId);
    expect(useCanvasStore.getState().shapes).toHaveLength(0);
    expect(useCanvasStore.getState().history.length).toBe(historyLenBefore);
  });
});
