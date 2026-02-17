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
