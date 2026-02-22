import { beforeEach, describe, expect, it } from "vitest";
import type { Shape, FrameShape, RectShape, CircleShape } from "@/lib/types";
import { useCanvasStore } from "@/store/canvas-store";
import { useUIStore } from "@/store/ui-store";
import { computeStickyFontSize } from "@/lib/sticky-text";

function resetStores() {
  useCanvasStore.setState({
    shapes: [],
    selectedIds: [],
    clipboard: [],
    history: [],
    historyIndex: -1,
  });
  useUIStore.setState({
    activeTool: "pointer",
    connectorSourceSelected: false,
    interaction: "idle",
  });
}

// ═══════════════════════════════════════════════════════════════════════
// 1. Standardized shape creation (no random sizes/colors)
// ═══════════════════════════════════════════════════════════════════════
describe("standardized shape creation", () => {
  beforeEach(resetStores);

  it("addRect creates shapes with consistent size and color", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    store.addRect(500, 500);

    const shapes = useCanvasStore.getState().shapes;
    const rects = shapes.filter((s) => s.type === "rect") as RectShape[];
    expect(rects).toHaveLength(2);

    for (const r of rects) {
      expect(r.w).toBe(120);
      expect(r.h).toBe(80);
      expect(r.fill).toBe("#3b82f6");
      expect(r.cornerRadius).toBe(4);
    }
  });

  it("addRect centers shape at given coordinates", () => {
    const store = useCanvasStore.getState();
    store.addRect(200, 150);
    const rect = useCanvasStore.getState().shapes[0] as RectShape;
    expect(rect.x).toBe(200 - 60); // centerX - w/2
    expect(rect.y).toBe(150 - 40); // centerY - h/2
  });

  it("addCircle creates shapes with consistent radius and color", () => {
    const store = useCanvasStore.getState();
    store.addCircle(100, 100);
    store.addCircle(500, 500);

    const shapes = useCanvasStore.getState().shapes;
    const circles = shapes.filter((s) => s.type === "circle") as CircleShape[];
    expect(circles).toHaveLength(2);

    for (const c of circles) {
      expect(c.radiusX).toBe(45);
      expect(c.radiusY).toBe(45);
      expect(c.fill).toBe("#3b82f6");
    }
  });

  it("addCircle centers shape at given coordinates", () => {
    const store = useCanvasStore.getState();
    store.addCircle(300, 250);
    const circle = useCanvasStore.getState().shapes[0] as CircleShape;
    expect(circle.x).toBe(300);
    expect(circle.y).toBe(250);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. Frame auto-containment
// ═══════════════════════════════════════════════════════════════════════
describe("frame auto-containment", () => {
  beforeEach(resetStores);

  it("addFrameAtBounds assigns parentId to shapes fully inside frame", () => {
    const store = useCanvasStore.getState();
    // Create a rect at (50, 50) with size 120x80 => bounds [50,50,170,130]
    store.addRect(110, 90); // centered: x=50, y=50
    const rectId = useCanvasStore.getState().shapes[0].id;

    // Create frame that fully contains the rect
    store.addFrameAtBounds(0, 0, 300, 300);
    const frameId = useCanvasStore.getState().shapes.find((s) => s.type === "frame")!.id;

    const rect = useCanvasStore.getState().shapes.find((s) => s.id === rectId);
    expect(rect!.parentId).toBe(frameId);
  });

  it("addFrameAtBounds does NOT assign parentId to shapes outside frame", () => {
    const store = useCanvasStore.getState();
    // Create a rect at (500, 500) — far outside frame bounds
    store.addRect(560, 540);
    const rectId = useCanvasStore.getState().shapes[0].id;

    store.addFrameAtBounds(0, 0, 200, 200);

    const rect = useCanvasStore.getState().shapes.find((s) => s.id === rectId);
    expect(rect!.parentId).toBeUndefined();
  });

  it("addFrameAtBounds does NOT assign parentId to partially overlapping shapes", () => {
    const store = useCanvasStore.getState();
    // Rect centered at (200,200): x=140, y=160, bounds [140,160,260,240]
    store.addRect(200, 200);
    const rectId = useCanvasStore.getState().shapes[0].id;

    // Frame from (0,0) to (200,200) — rect extends past right & bottom edges
    store.addFrameAtBounds(0, 0, 200, 200);

    const rect = useCanvasStore.getState().shapes.find((s) => s.id === rectId);
    expect(rect!.parentId).toBeUndefined();
  });

  it("addFrameAtBounds nests inner frames under outer frames", () => {
    const store = useCanvasStore.getState();
    store.addFrameAtBounds(50, 50, 100, 100);
    const innerFrameId = useCanvasStore.getState().shapes[0].id;

    // Outer frame that fully contains the inner frame
    store.addFrameAtBounds(0, 0, 300, 300);
    const outerFrameId = useCanvasStore
      .getState()
      .shapes.find((s) => s.type === "frame" && s.id !== innerFrameId)!.id;

    const innerFrame = useCanvasStore.getState().shapes.find((s) => s.id === innerFrameId);
    expect(innerFrame!.parentId).toBe(outerFrameId);
  });

  it("addFrameAtBounds does NOT assign parentId to connectors", () => {
    const store = useCanvasStore.getState();
    store.addConnector({ point: { x: 50, y: 50 } }, { point: { x: 100, y: 100 } }, "line");
    const connId = useCanvasStore.getState().shapes[0].id;

    store.addFrameAtBounds(0, 0, 200, 200);

    const conn = useCanvasStore.getState().shapes.find((s) => s.id === connId);
    expect(conn!.parentId).toBeUndefined();
  });

  it("addFrameAtBounds does NOT re-parent shapes already parented", () => {
    const store = useCanvasStore.getState();
    // addRect(160,140) => x=100, y=100, w=120, h=80 => bounds [100,100,220,180]
    store.addRect(160, 140);
    const rectId = useCanvasStore.getState().shapes[0].id;

    // First frame fully contains the rect: [0,0] to [300,300]
    store.addFrameAtBounds(0, 0, 300, 300);
    const firstFrameId = useCanvasStore.getState().shapes.find((s) => s.type === "frame")!.id;

    // Verify it got parented
    expect(useCanvasStore.getState().shapes.find((s) => s.id === rectId)!.parentId).toBe(
      firstFrameId
    );

    // Second bigger frame also contains the rect — but it's already parented
    store.addFrameAtBounds(0, 0, 500, 500);

    const rect = useCanvasStore.getState().shapes.find((s) => s.id === rectId);
    expect(rect!.parentId).toBe(firstFrameId); // stays with original parent
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. Frame deletion clears parentId on children
// ═══════════════════════════════════════════════════════════════════════
describe("frame deletion", () => {
  beforeEach(resetStores);

  it("deleteShapes clears parentId on frame children instead of deleting them", () => {
    const store = useCanvasStore.getState();
    // addRect(160,140) => x=100, y=100, w=120, h=80 => bounds [100,100] to [220,180]
    store.addRect(160, 140);
    const rectId = useCanvasStore.getState().shapes[0].id;

    store.addFrameAtBounds(0, 0, 300, 300);
    const frameId = useCanvasStore.getState().shapes.find((s) => s.type === "frame")!.id;

    // Verify parenting
    expect(useCanvasStore.getState().shapes.find((s) => s.id === rectId)!.parentId).toBe(frameId);

    // Delete the frame
    store.deleteShapes([frameId]);

    const shapes = useCanvasStore.getState().shapes;
    // Rect should survive with cleared parentId
    expect(shapes).toHaveLength(1);
    expect(shapes[0].id).toBe(rectId);
    expect(shapes[0].parentId).toBeUndefined();
  });

  it("deleteShapes handles frame with multiple children", () => {
    const store = useCanvasStore.getState();
    store.addRect(50, 50);
    store.addCircle(100, 100);
    const rectId = useCanvasStore.getState().shapes[0].id;
    const circleId = useCanvasStore.getState().shapes[1].id;

    store.addFrameAtBounds(0, 0, 500, 500);
    const frameId = useCanvasStore.getState().shapes.find((s) => s.type === "frame")!.id;

    store.deleteShapes([frameId]);

    const shapes = useCanvasStore.getState().shapes;
    expect(shapes).toHaveLength(2);
    expect(shapes.find((s) => s.id === rectId)!.parentId).toBeUndefined();
    expect(shapes.find((s) => s.id === circleId)!.parentId).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. Connector creation: no infinite loop on tool switch
// ═══════════════════════════════════════════════════════════════════════
describe("connector source selected flag", () => {
  beforeEach(resetStores);

  it("setConnectorSourceSelected does not cause infinite loop when debug-store has subscriber", () => {
    // Simulate what useConnectorCreation does:
    // Subscribe to debug-store, and inside the subscriber call setConnectorSourceSelected
    let callCount = 0;
    const maxCalls = 100;

    const unsub = useUIStore.subscribe((state) => {
      callCount++;
      if (callCount > maxCalls) {
        throw new Error("Infinite loop detected!");
      }
      // This simulates what clearConnectorFrom does:
      // Only react to activeTool changes, not connectorSourceSelected changes
      // (This is the fixed pattern)
    });

    // This should NOT cause infinite recursion
    useUIStore.getState().setConnectorSourceSelected(true);
    useUIStore.getState().setConnectorSourceSelected(false);
    useUIStore.getState().setActiveTool("connector");
    useUIStore.getState().setActiveTool("pointer");

    expect(callCount).toBeLessThan(maxCalls);
    unsub();
  });

  it("activeTool changes propagate through subscriber without recursion", () => {
    let prevTool = useUIStore.getState().activeTool;
    let toolSwitchCount = 0;

    const unsub = useUIStore.subscribe((state) => {
      const currTool = state.activeTool;
      if (currTool === prevTool) return;
      const wasCon = prevTool === "connector";
      prevTool = currTool;
      if (wasCon && currTool !== "connector") {
        toolSwitchCount++;
        // Simulate clearConnectorFrom calling setConnectorSourceSelected
        useUIStore.getState().setConnectorSourceSelected(false);
      }
    });

    useUIStore.getState().setActiveTool("connector");
    useUIStore.getState().setActiveTool("pointer");

    // Should only fire once, not infinitely
    expect(toolSwitchCount).toBe(1);
    expect(useUIStore.getState().connectorSourceSelected).toBe(false);
    unsub();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. Placement tools in debug-store
// ═══════════════════════════════════════════════════════════════════════
describe("placement tool states", () => {
  beforeEach(resetStores);

  it("supports all placement tool types", () => {
    const tools = [
      "place-rect",
      "place-circle",
      "place-text",
      "place-sticky",
      "draw-frame",
    ] as const;

    for (const tool of tools) {
      useUIStore.getState().setActiveTool(tool);
      expect(useUIStore.getState().activeTool).toBe(tool);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. Sticky note auto-scale font size
// ═══════════════════════════════════════════════════════════════════════
describe("computeStickyFontSize", () => {
  it("returns maxFontSize for short text", () => {
    const size = computeStickyFontSize("Hi", 176, 176, 16);
    expect(size).toBe(16);
  });

  it("shrinks font for long text", () => {
    const longText =
      "This is a very long text that should not fit in the sticky note at the default font size and needs to be shrunk down significantly. Adding even more words here to ensure the text overflows the available height when rendered at the maximum font size in a small container.";
    const size = computeStickyFontSize(longText, 100, 80, 16);
    expect(size).toBeLessThan(16);
    expect(size).toBeGreaterThanOrEqual(10); // minFontSize default
  });

  it("respects minFontSize floor", () => {
    const veryLongText = "word ".repeat(500);
    const size = computeStickyFontSize(veryLongText, 176, 176, 16, 10);
    expect(size).toBe(10);
  });

  it("handles empty text", () => {
    const size = computeStickyFontSize("", 176, 176, 16);
    expect(size).toBe(16);
  });

  it("handles single word", () => {
    const size = computeStickyFontSize("Hello", 176, 176, 24);
    expect(size).toBe(24);
  });

  it("shrinks more for narrow containers", () => {
    const text = "This is a moderately long text for testing";
    const wide = computeStickyFontSize(text, 300, 300, 16);
    const narrow = computeStickyFontSize(text, 80, 80, 16);
    expect(narrow).toBeLessThanOrEqual(wide);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 7. parentId field on BaseShape
// ═══════════════════════════════════════════════════════════════════════
describe("parentId field", () => {
  beforeEach(resetStores);

  it("shapes are created without parentId by default", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    store.addCircle(200, 200);
    store.addText(300, 300);
    store.addStickyNote(400, 400);

    const shapes = useCanvasStore.getState().shapes;
    for (const s of shapes) {
      expect(s.parentId).toBeUndefined();
    }
  });

  it("updateShape can set and clear parentId", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    const rectId = useCanvasStore.getState().shapes[0].id;

    store.pushHistory();
    store.updateShape(rectId, { parentId: "some-frame-id" });
    expect(useCanvasStore.getState().shapes[0].parentId).toBe("some-frame-id");

    store.pushHistory();
    store.updateShape(rectId, { parentId: undefined });
    expect(useCanvasStore.getState().shapes[0].parentId).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 8. addFrameAtBounds
// ═══════════════════════════════════════════════════════════════════════
describe("addFrameAtBounds", () => {
  beforeEach(resetStores);

  it("creates frame at exact bounds", () => {
    const store = useCanvasStore.getState();
    const id = store.addFrameAtBounds(100, 200, 400, 300, "Test Section");

    const frame = useCanvasStore.getState().shapes.find((s) => s.id === id) as FrameShape;
    expect(frame).toBeDefined();
    expect(frame.type).toBe("frame");
    expect(frame.x).toBe(100);
    expect(frame.y).toBe(200);
    expect(frame.w).toBe(400);
    expect(frame.h).toBe(300);
    expect(frame.title).toBe("Test Section");
    expect(frame.zIndex).toBe(0);
  });

  it("defaults title to 'Frame'", () => {
    const store = useCanvasStore.getState();
    const id = store.addFrameAtBounds(0, 0, 100, 100);

    const frame = useCanvasStore.getState().shapes.find((s) => s.id === id) as FrameShape;
    expect(frame.title).toBe("Frame");
  });

  it("selects the frame after creation", () => {
    const store = useCanvasStore.getState();
    const id = store.addFrameAtBounds(0, 0, 100, 100);
    expect(useCanvasStore.getState().selectedIds).toEqual([id]);
  });

  it("pushes history for undo support", () => {
    const store = useCanvasStore.getState();
    store.addFrameAtBounds(0, 0, 100, 100);

    expect(useCanvasStore.getState().historyIndex).toBeGreaterThanOrEqual(0);

    store.undo();
    expect(useCanvasStore.getState().shapes).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 9. fontStyle on text/sticky shapes
// ═══════════════════════════════════════════════════════════════════════
describe("fontStyle field", () => {
  beforeEach(resetStores);

  it("text shapes support fontStyle update", () => {
    const store = useCanvasStore.getState();
    const id = store.addText(100, 100);
    store.pushHistory();
    store.updateShape(id, { fontStyle: "bold" });

    const text = useCanvasStore.getState().shapes.find((s) => s.id === id);
    if (text!.type !== "text") throw new Error("unreachable");
    expect(text!.fontStyle).toBe("bold");
  });

  it("sticky shapes support fontStyle update", () => {
    const store = useCanvasStore.getState();
    const id = store.addStickyNote(100, 100);
    store.pushHistory();
    store.updateShape(id, { fontStyle: "italic" });

    const sticky = useCanvasStore.getState().shapes.find((s) => s.id === id);
    if (sticky!.type !== "sticky") throw new Error("unreachable");
    expect(sticky!.fontStyle).toBe("italic");
  });

  it("fontStyle defaults to undefined (treated as normal)", () => {
    const store = useCanvasStore.getState();
    store.addText(100, 100);
    store.addStickyNote(200, 200);

    const shapes = useCanvasStore.getState().shapes;
    for (const s of shapes) {
      expect(s.type === "text" || s.type === "sticky" ? s.fontStyle : undefined).toBeUndefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 10. Integration: frame + contained shapes + deletion
// ═══════════════════════════════════════════════════════════════════════
describe("frame integration scenarios", () => {
  beforeEach(resetStores);

  it("full workflow: create shapes, frame them, delete frame, shapes survive", () => {
    const store = useCanvasStore.getState();

    // Create shapes inside a 500x500 area
    store.addRect(100, 100);
    store.addCircle(200, 200);
    store.addStickyNote(300, 300);

    const shapeIds = useCanvasStore.getState().shapes.map((s) => s.id);
    expect(shapeIds).toHaveLength(3);

    // Frame all shapes
    store.addFrameAtBounds(0, 0, 600, 600);
    const frameId = useCanvasStore.getState().shapes.find((s) => s.type === "frame")!.id;

    // All shapes should be parented
    for (const id of shapeIds) {
      const shape = useCanvasStore.getState().shapes.find((s) => s.id === id);
      expect(shape!.parentId).toBe(frameId);
    }

    // Delete frame
    store.deleteShapes([frameId]);

    // All original shapes survive without parentId
    const remaining = useCanvasStore.getState().shapes;
    expect(remaining).toHaveLength(3);
    for (const s of remaining) {
      expect(s.parentId).toBeUndefined();
    }
  });

  it("undo after addFrameAtBounds restores original parentId state", () => {
    const store = useCanvasStore.getState();
    // addRect(160,140) => x=100, y=100, w=120, h=80 => fully inside [0,0,300,300]
    store.addRect(160, 140);
    const rectId = useCanvasStore.getState().shapes[0].id;

    // Rect should have no parent
    expect(useCanvasStore.getState().shapes[0].parentId).toBeUndefined();

    store.addFrameAtBounds(0, 0, 300, 300);

    // Rect should be parented
    expect(useCanvasStore.getState().shapes.find((s) => s.id === rectId)!.parentId).toBeDefined();

    // Undo should restore original state
    store.undo();
    const afterUndo = useCanvasStore.getState().shapes;
    expect(afterUndo).toHaveLength(1);
    expect(afterUndo[0].id).toBe(rectId);
    expect(afterUndo[0].parentId).toBeUndefined();
  });
});
