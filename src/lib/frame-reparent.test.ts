import { beforeEach, describe, expect, it } from "vitest";
import type { Shape, RectShape, FrameShape, ConnectorShape } from "@/lib/types";
import { useCanvasStore } from "@/store/canvas-store";
import { getShapeBounds } from "@/lib/shape-geometry";
import { diffShapeWrites } from "@/lib/board-sync-diff";

function resetStore() {
  useCanvasStore.setState({
    shapes: [],
    selectedIds: [],
    clipboard: [],
    history: [],
    historyIndex: -1,
  });
}

function makeRect(id: string, x: number, y: number, w = 100, h = 60, parentId?: string): RectShape {
  return {
    id,
    type: "rect",
    x,
    y,
    w,
    h,
    fill: "#3b82f6",
    rotation: 0,
    opacity: 1,
    zIndex: 1,
    parentId,
  };
}

function makeFrame(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  parentId?: string
): FrameShape {
  return {
    id,
    type: "frame",
    x,
    y,
    w,
    h,
    title: "Frame",
    fill: "rgba(0,0,0,0.03)",
    stroke: "#a1a1aa",
    rotation: 0,
    opacity: 1,
    zIndex: 0,
    parentId,
  };
}

function makeConnector(id: string, fromId: string, toId: string): ConnectorShape {
  return {
    id,
    type: "connector",
    x: 0,
    y: 0,
    fromId,
    toId,
    style: "arrow",
    stroke: "#6b7280",
    strokeWidth: 2,
    rotation: 0,
    opacity: 1,
    zIndex: 2,
  };
}

/**
 * Pure re-implementation of the re-parenting algorithm from useDragSession.ts
 * handleDragEnd. This lets us test the logic without Konva/DOM dependencies.
 */
function computeReparenting(
  shapes: Shape[],
  draggedIds: Set<string>
): Array<{ id: string; newParentId: string | undefined }> {
  const frames = shapes.filter((s): s is FrameShape => s.type === "frame");
  const draggedAFrame = frames.some((f) => draggedIds.has(f.id));
  const updates: Array<{ id: string; newParentId: string | undefined }> = [];

  for (const shape of shapes) {
    if (shape.type === "connector") continue;

    const wasDragged = draggedIds.has(shape.id);
    const parentWasDragged = shape.parentId ? draggedIds.has(shape.parentId) : false;
    if (!wasDragged && !parentWasDragged && !draggedAFrame) continue;

    const bounds = getShapeBounds(shape);
    let newParentId: string | undefined;

    for (const frame of frames) {
      if (frame.id === shape.id) continue;
      if (shape.type === "frame" && frame.parentId === shape.id) continue;

      const fx = frame.x,
        fy = frame.y;
      const fr = fx + frame.w,
        fb = fy + frame.h;
      const inside =
        bounds.x >= fx &&
        bounds.y >= fy &&
        bounds.x + bounds.width <= fr &&
        bounds.y + bounds.height <= fb;

      if (inside) {
        if (!newParentId) {
          newParentId = frame.id;
        } else {
          const prev = frames.find((f) => f.id === newParentId);
          if (prev && frame.w * frame.h < prev.w * prev.h) {
            newParentId = frame.id;
          }
        }
      }
    }

    if (shape.parentId !== newParentId) {
      updates.push({ id: shape.id, newParentId });
    }
  }

  return updates;
}

// ═══════════════════════════════════════════════════════════════════════
// Re-parenting algorithm (pure logic from useDragSession handleDragEnd)
// ═══════════════════════════════════════════════════════════════════════
describe("frame re-parenting after drag", () => {
  it("clears parentId when child is dragged fully outside frame", () => {
    const frame = makeFrame("f1", 0, 0, 400, 300);
    const rect = makeRect("r1", 500, 500, 100, 60, "f1"); // outside
    const updates = computeReparenting([frame, rect], new Set(["r1"]));

    expect(updates).toEqual([{ id: "r1", newParentId: undefined }]);
  });

  it("assigns parentId when free shape is dragged into frame", () => {
    const frame = makeFrame("f1", 0, 0, 400, 300);
    const rect = makeRect("r1", 50, 50, 100, 60); // inside, no parent
    const updates = computeReparenting([frame, rect], new Set(["r1"]));

    expect(updates).toEqual([{ id: "r1", newParentId: "f1" }]);
  });

  it("switches parentId when child is dragged from frameA to frameB", () => {
    const frameA = makeFrame("fA", 0, 0, 400, 300);
    const frameB = makeFrame("fB", 500, 0, 400, 300);
    const rect = makeRect("r1", 550, 50, 100, 60, "fA"); // inside frameB
    const updates = computeReparenting([frameA, frameB, rect], new Set(["r1"]));

    expect(updates).toEqual([{ id: "r1", newParentId: "fB" }]);
  });

  it("does NOT parent shape partially overlapping frame", () => {
    const frame = makeFrame("f1", 0, 0, 400, 300);
    // rect at (350, 50) with w=100 → right edge at 450, outside frame's 400
    const rect = makeRect("r1", 350, 50, 100, 60);
    const updates = computeReparenting([frame, rect], new Set(["r1"]));

    expect(updates).toEqual([]); // no parentId, no change
  });

  it("never parents connectors", () => {
    const frame = makeFrame("f1", 0, 0, 400, 300);
    const rect = makeRect("r1", 50, 50);
    const conn = makeConnector("c1", "r1", "r1");
    const updates = computeReparenting([frame, rect, conn], new Set(["c1"]));

    // Connector should be skipped entirely
    expect(updates.find((u) => u.id === "c1")).toBeUndefined();
  });

  it("picks smallest containing frame for nested frames", () => {
    const outer = makeFrame("fOuter", 0, 0, 800, 600);
    const inner = makeFrame("fInner", 50, 50, 200, 200);
    const rect = makeRect("r1", 60, 60, 80, 40); // inside both
    const updates = computeReparenting([outer, inner, rect], new Set(["r1"]));

    expect(updates).toEqual([{ id: "r1", newParentId: "fInner" }]);
  });

  it("children stay parented when dragged with their frame", () => {
    // Frame moved from (0,0) to (100,100), child moved same delta
    const frame = makeFrame("f1", 100, 100, 400, 300);
    const rect = makeRect("r1", 150, 150, 100, 60, "f1"); // still inside
    // Both were dragged together
    const updates = computeReparenting([frame, rect], new Set(["f1", "r1"]));

    expect(updates).toEqual([]); // parentId unchanged
  });

  it("no change when undragged shape stays in its frame", () => {
    const frame = makeFrame("f1", 0, 0, 400, 300);
    const rect = makeRect("r1", 50, 50, 100, 60, "f1");
    // Neither was dragged
    const updates = computeReparenting([frame, rect], new Set([]));

    expect(updates).toEqual([]);
  });

  it("adopts static shapes when frame is dragged over them", () => {
    // Frame dragged to cover a static rect that was previously outside
    const frame = makeFrame("f1", 0, 0, 400, 300);
    const rect = makeRect("r1", 50, 50, 100, 60); // inside frame, no parent
    // Only the frame was dragged — rect was static
    const updates = computeReparenting([frame, rect], new Set(["f1"]));

    expect(updates).toEqual([{ id: "r1", newParentId: "f1" }]);
  });

  it("does NOT adopt static shape still outside after frame drag", () => {
    const frame = makeFrame("f1", 0, 0, 400, 300);
    const rect = makeRect("r1", 500, 500, 100, 60); // outside
    const updates = computeReparenting([frame, rect], new Set(["f1"]));

    expect(updates).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// End-to-end: store mutation → diffShapeWrites captures parentId change
// ═══════════════════════════════════════════════════════════════════════
describe("parentId clearing flows through diffShapeWrites", () => {
  beforeEach(resetStore);

  it("clearing parentId via updateShapes produces a diff with parentId: undefined", () => {
    const rect = makeRect("r1", 50, 50, 100, 60, "frame1");
    useCanvasStore.setState({ shapes: [rect] });

    const prevShapes = useCanvasStore.getState().shapes;

    // Simulate what handleDragEnd does: clear parentId
    useCanvasStore.getState().updateShapes([{ id: "r1", patch: { parentId: undefined } }]);

    const currShapes = useCanvasStore.getState().shapes;
    const diff = diffShapeWrites(prevShapes, currShapes);

    expect(diff.modified).toHaveLength(1);
    expect(diff.modified[0].id).toBe("r1");
    expect("parentId" in diff.modified[0].patch).toBe(true);
    expect(diff.modified[0].patch.parentId).toBeUndefined();
  });

  it("setting parentId via updateShapes produces a diff with the new value", () => {
    const rect = makeRect("r1", 50, 50);
    useCanvasStore.setState({ shapes: [rect] });

    const prevShapes = useCanvasStore.getState().shapes;

    useCanvasStore.getState().updateShapes([{ id: "r1", patch: { parentId: "frame1" } }]);

    const currShapes = useCanvasStore.getState().shapes;
    const diff = diffShapeWrites(prevShapes, currShapes);

    expect(diff.modified).toHaveLength(1);
    expect(diff.modified[0].patch.parentId).toBe("frame1");
  });

  it("frame deletion clears children parentId and diff captures it", () => {
    const frame = makeFrame("f1", 0, 0, 400, 300);
    const rect = makeRect("r1", 50, 50, 100, 60, "f1");
    useCanvasStore.setState({ shapes: [frame, rect] });

    const prevShapes = useCanvasStore.getState().shapes;

    useCanvasStore.getState().deleteShapes(["f1"]);

    const currShapes = useCanvasStore.getState().shapes;
    const diff = diffShapeWrites(prevShapes, currShapes);

    // Frame was deleted
    expect(diff.deleted).toContain("f1");
    // Rect survived with parentId cleared
    expect(currShapes).toHaveLength(1);
    expect(currShapes[0].parentId).toBeUndefined();
    // Diff should show the parentId change (prev had parentId, curr doesn't effectively)
    // Note: diff compares prevShapes (which still has rect with parentId "f1")
    // against currShapes (rect without parentId) — but rect is modified, not re-added
    expect(diff.modified).toHaveLength(1);
    expect(diff.modified[0].id).toBe("r1");
    expect("parentId" in diff.modified[0].patch).toBe(true);
  });
});
