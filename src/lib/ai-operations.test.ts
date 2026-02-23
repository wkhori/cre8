import { beforeEach, describe, expect, it } from "vitest";
import type { Shape } from "@/lib/types";
import type { AIOperation } from "@/lib/ai-tools";
import { useCanvasStore } from "@/store/canvas-store";
import { executeAIOperations } from "@/lib/ai-operations";

function resetCanvasStore() {
  useCanvasStore.setState({
    shapes: [],
    selectedIds: [],
    clipboard: [],
    history: [],
    historyIndex: -1,
  });
}

function shapeIds() {
  return useCanvasStore.getState().shapes.map((s) => s.id);
}

describe("AI operations undo/redo", () => {
  beforeEach(() => {
    resetCanvasStore();
  });

  it("single AI createStickyNote is fully undoable", () => {
    const ops: AIOperation[] = [
      { type: "createStickyNote", tempId: "t1", x: 100, y: 100, text: "AI Note" },
    ];
    executeAIOperations(ops);

    expect(useCanvasStore.getState().shapes).toHaveLength(1);
    const sticky = useCanvasStore.getState().shapes[0];
    if (sticky.type !== "sticky") throw new Error("unreachable");
    expect(sticky.text).toBe("AI Note");

    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().shapes).toHaveLength(0);

    useCanvasStore.getState().redo();
    expect(useCanvasStore.getState().shapes).toHaveLength(1);
    const restored = useCanvasStore.getState().shapes[0];
    if (restored.type !== "sticky") throw new Error("unreachable");
    expect(restored.text).toBe("AI Note");
  });

  it("AI batch create (multiple shapes) is a single undo step", () => {
    const ops: AIOperation[] = [
      { type: "createStickyNote", tempId: "t1", x: 0, y: 0, text: "Note 1" },
      { type: "createStickyNote", tempId: "t2", x: 300, y: 0, text: "Note 2" },
      { type: "createStickyNote", tempId: "t3", x: 600, y: 0, text: "Note 3" },
    ];
    executeAIOperations(ops);
    expect(useCanvasStore.getState().shapes).toHaveLength(3);

    // Single undo removes ALL 3 shapes
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().shapes).toHaveLength(0);

    // Single redo restores ALL 3
    useCanvasStore.getState().redo();
    expect(useCanvasStore.getState().shapes).toHaveLength(3);
  });

  it("AI createShape (rect) is undoable", () => {
    const ops: AIOperation[] = [
      { type: "createShape", tempId: "t1", shapeType: "rectangle", x: 50, y: 50, w: 200, h: 100 },
    ];
    executeAIOperations(ops);
    expect(useCanvasStore.getState().shapes).toHaveLength(1);
    expect(useCanvasStore.getState().shapes[0].type).toBe("rect");

    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().shapes).toHaveLength(0);
  });

  it("AI createShape (circle) is undoable", () => {
    const ops: AIOperation[] = [
      { type: "createShape", tempId: "t1", shapeType: "circle", x: 50, y: 50, w: 100, h: 100 },
    ];
    executeAIOperations(ops);
    expect(useCanvasStore.getState().shapes).toHaveLength(1);
    expect(useCanvasStore.getState().shapes[0].type).toBe("circle");

    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().shapes).toHaveLength(0);
  });

  it("AI createText is undoable", () => {
    const ops: AIOperation[] = [
      { type: "createText", tempId: "t1", x: 100, y: 100, text: "Hello World" },
    ];
    executeAIOperations(ops);
    const text = useCanvasStore.getState().shapes[0];
    if (text.type !== "text") throw new Error("unreachable");
    expect(text.text).toBe("Hello World");

    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().shapes).toHaveLength(0);
  });

  it("AI createFrame is undoable", () => {
    const ops: AIOperation[] = [
      { type: "createFrame", tempId: "t1", x: 0, y: 0, title: "AI Frame", w: 500, h: 400 },
    ];
    executeAIOperations(ops);
    const frame = useCanvasStore.getState().shapes[0];
    if (frame.type !== "frame") throw new Error("unreachable");
    expect(frame.title).toBe("AI Frame");

    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().shapes).toHaveLength(0);
  });

  it("AI createConnector with tempId remapping is undoable", () => {
    const ops: AIOperation[] = [
      { type: "createShape", tempId: "t1", shapeType: "rectangle", x: 0, y: 0, w: 100, h: 50 },
      { type: "createShape", tempId: "t2", shapeType: "rectangle", x: 300, y: 0, w: 100, h: 50 },
      { type: "createConnector", tempId: "t3", fromId: "t1", toId: "t2", style: "arrow" },
    ];
    const idMap = executeAIOperations(ops);
    expect(useCanvasStore.getState().shapes).toHaveLength(3);

    // Verify connector refs are real IDs, not temp IDs
    const conn = useCanvasStore.getState().shapes.find((s) => s.type === "connector");
    if (!conn || conn.type !== "connector") throw new Error("unreachable");
    expect(conn.fromId).toBe(idMap.get("t1"));
    expect(conn.toId).toBe(idMap.get("t2"));

    // Single undo removes all 3
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().shapes).toHaveLength(0);
  });

  it("AI moveObject is undoable", () => {
    // Pre-populate a shape
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    const rectId = useCanvasStore.getState().shapes[0].id;
    const originalX = useCanvasStore.getState().shapes[0].x;
    const originalY = useCanvasStore.getState().shapes[0].y;

    const ops: AIOperation[] = [{ type: "moveObject", objectId: rectId, x: 500, y: 600 }];
    executeAIOperations(ops);
    expect(useCanvasStore.getState().shapes[0].x).toBe(500);
    expect(useCanvasStore.getState().shapes[0].y).toBe(600);

    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().shapes[0].x).toBe(originalX);
    expect(useCanvasStore.getState().shapes[0].y).toBe(originalY);
  });

  it("AI resizeObject is undoable", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    const rectId = useCanvasStore.getState().shapes[0].id;
    const rect = useCanvasStore.getState().shapes[0] as Shape & { w: number; h: number };
    const originalW = rect.w;
    const originalH = rect.h;

    const ops: AIOperation[] = [{ type: "resizeObject", objectId: rectId, w: 400, h: 300 }];
    executeAIOperations(ops);
    const resized = useCanvasStore.getState().shapes[0] as Shape & { w: number; h: number };
    expect(resized.w).toBe(400);
    expect(resized.h).toBe(300);

    useCanvasStore.getState().undo();
    const restored = useCanvasStore.getState().shapes[0] as Shape & { w: number; h: number };
    expect(restored.w).toBe(originalW);
    expect(restored.h).toBe(originalH);
  });

  it("AI updateText is undoable", () => {
    const store = useCanvasStore.getState();
    store.addStickyNote(100, 100, "before AI");
    const stickyId = useCanvasStore.getState().shapes[0].id;

    const ops: AIOperation[] = [{ type: "updateText", objectId: stickyId, newText: "after AI" }];
    executeAIOperations(ops);
    const updated = useCanvasStore.getState().shapes[0];
    if (updated.type !== "sticky") throw new Error("unreachable");
    expect(updated.text).toBe("after AI");

    useCanvasStore.getState().undo();
    const restored = useCanvasStore.getState().shapes[0];
    if (restored.type !== "sticky") throw new Error("unreachable");
    expect(restored.text).toBe("before AI");
  });

  it("AI updateText on frame title is undoable", () => {
    const store = useCanvasStore.getState();
    store.addFrame(200, 200, "Old Title");
    const frameId = useCanvasStore.getState().shapes[0].id;

    const ops: AIOperation[] = [{ type: "updateText", objectId: frameId, newText: "New Title" }];
    executeAIOperations(ops);
    const updated = useCanvasStore.getState().shapes[0];
    if (updated.type !== "frame") throw new Error("unreachable");
    expect(updated.title).toBe("New Title");

    useCanvasStore.getState().undo();
    const restored = useCanvasStore.getState().shapes[0];
    if (restored.type !== "frame") throw new Error("unreachable");
    expect(restored.title).toBe("Old Title");
  });

  it("AI changeColor is undoable", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    const rectId = useCanvasStore.getState().shapes[0].id;
    const originalFill = (useCanvasStore.getState().shapes[0] as { fill: string }).fill;

    const ops: AIOperation[] = [{ type: "changeColor", objectId: rectId, color: "#ff0000" }];
    executeAIOperations(ops);
    expect((useCanvasStore.getState().shapes[0] as { fill: string }).fill).toBe("#ff0000");

    useCanvasStore.getState().undo();
    expect((useCanvasStore.getState().shapes[0] as { fill: string }).fill).toBe(originalFill);
  });

  it("AI changeColor on sticky uses color field and is undoable", () => {
    const store = useCanvasStore.getState();
    store.addStickyNote(100, 100, "test", "#fef08a");
    const stickyId = useCanvasStore.getState().shapes[0].id;

    const ops: AIOperation[] = [{ type: "changeColor", objectId: stickyId, color: "#bbf7d0" }];
    executeAIOperations(ops);
    const updated = useCanvasStore.getState().shapes[0];
    if (updated.type !== "sticky") throw new Error("unreachable");
    expect(updated.color).toBe("#bbf7d0");

    useCanvasStore.getState().undo();
    const restored = useCanvasStore.getState().shapes[0];
    if (restored.type !== "sticky") throw new Error("unreachable");
    expect(restored.color).toBe("#fef08a");
  });

  it("AI deleteObjects is undoable", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    store.addCircle(300, 300);
    const ids = shapeIds();

    const ops: AIOperation[] = [{ type: "deleteObjects", objectIds: ids }];
    executeAIOperations(ops);
    expect(useCanvasStore.getState().shapes).toHaveLength(0);

    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().shapes).toHaveLength(2);
    expect(shapeIds()).toEqual(ids);
  });

  it("complex AI batch (create + move + color + delete) is single undo step", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    const rectId = useCanvasStore.getState().shapes[0].id;
    const beforeAI = useCanvasStore.getState().shapes.map((s) => ({ ...s }));

    const ops: AIOperation[] = [
      { type: "createStickyNote", tempId: "t1", x: 200, y: 200, text: "New" },
      { type: "moveObject", objectId: rectId, x: 500, y: 500 },
      { type: "changeColor", objectId: rectId, color: "#00ff00" },
    ];
    executeAIOperations(ops);
    expect(useCanvasStore.getState().shapes).toHaveLength(2);
    expect(useCanvasStore.getState().shapes.find((s) => s.id === rectId)!.x).toBe(500);

    // Single undo reverts entire batch
    useCanvasStore.getState().undo();
    const restored = useCanvasStore.getState().shapes;
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe(rectId);
    expect(restored[0].x).toBe(beforeAI[0].x);
    expect(restored[0].y).toBe(beforeAI[0].y);
  });

  it("AI operations after manual edits: independent undo steps", () => {
    const store = useCanvasStore.getState();
    // Manual: add rect
    store.addRect(100, 100);
    const rectId = useCanvasStore.getState().shapes[0].id;

    // AI: add sticky
    const ops: AIOperation[] = [
      { type: "createStickyNote", tempId: "t1", x: 300, y: 300, text: "AI" },
    ];
    executeAIOperations(ops);
    expect(useCanvasStore.getState().shapes).toHaveLength(2);

    // Undo AI operation
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().shapes).toHaveLength(1);
    expect(useCanvasStore.getState().shapes[0].id).toBe(rectId);

    // Undo manual operation
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().shapes).toHaveLength(0);

    // Redo both
    useCanvasStore.getState().redo();
    expect(useCanvasStore.getState().shapes).toHaveLength(1);
    useCanvasStore.getState().redo();
    expect(useCanvasStore.getState().shapes).toHaveLength(2);
  });

  it("multiple AI batches create separate undo steps", () => {
    // First AI batch
    executeAIOperations([
      { type: "createStickyNote", tempId: "t1", x: 0, y: 0, text: "Batch 1A" },
      { type: "createStickyNote", tempId: "t2", x: 300, y: 0, text: "Batch 1B" },
    ]);
    expect(useCanvasStore.getState().shapes).toHaveLength(2);

    // Second AI batch
    executeAIOperations([
      { type: "createStickyNote", tempId: "t3", x: 0, y: 300, text: "Batch 2A" },
    ]);
    expect(useCanvasStore.getState().shapes).toHaveLength(3);

    // Undo second batch only
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().shapes).toHaveLength(2);

    // Undo first batch
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().shapes).toHaveLength(0);
  });

  it("AI operations return correct tempId → realId map", () => {
    const ops: AIOperation[] = [
      { type: "createStickyNote", tempId: "temp-sticky", x: 0, y: 0, text: "S" },
      {
        type: "createShape",
        tempId: "temp-rect",
        shapeType: "rectangle",
        x: 300,
        y: 0,
        w: 100,
        h: 50,
      },
      { type: "createFrame", tempId: "temp-frame", x: 0, y: 300, title: "F", w: 400, h: 300 },
    ];
    const idMap = executeAIOperations(ops);

    expect(idMap.size).toBe(3);
    expect(idMap.has("temp-sticky")).toBe(true);
    expect(idMap.has("temp-rect")).toBe(true);
    expect(idMap.has("temp-frame")).toBe(true);

    // All mapped IDs should exist in the store
    const shapes = useCanvasStore.getState().shapes;
    for (const realId of idMap.values()) {
      expect(shapes.find((s) => s.id === realId)).toBeDefined();
    }
  });

  it("AI connector uses remapped tempIds from same batch", () => {
    const ops: AIOperation[] = [
      { type: "createShape", tempId: "box-a", shapeType: "rectangle", x: 0, y: 0, w: 100, h: 50 },
      { type: "createShape", tempId: "box-b", shapeType: "rectangle", x: 400, y: 0, w: 100, h: 50 },
      { type: "createConnector", tempId: "conn", fromId: "box-a", toId: "box-b" },
    ];
    const idMap = executeAIOperations(ops);

    const conn = useCanvasStore.getState().shapes.find((s) => s.type === "connector");
    if (!conn || conn.type !== "connector") throw new Error("unreachable");

    // Connector should reference real IDs, not temp IDs
    expect(conn.fromId).toBe(idMap.get("box-a"));
    expect(conn.toId).toBe(idMap.get("box-b"));
    expect(conn.fromId).not.toBe("box-a");
    expect(conn.toId).not.toBe("box-b");
  });

  it("AI deleteObjects with tempIds from same batch works", () => {
    // Create shapes manually first
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    store.addCircle(300, 300);
    const [rect, circle] = useCanvasStore.getState().shapes;

    // AI batch: delete both existing shapes
    const ops: AIOperation[] = [{ type: "deleteObjects", objectIds: [rect.id, circle.id] }];
    executeAIOperations(ops);
    expect(useCanvasStore.getState().shapes).toHaveLength(0);

    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().shapes).toHaveLength(2);
  });

  it("AI resizeObject on circle adjusts radii and is undoable", () => {
    const store = useCanvasStore.getState();
    store.addCircle(200, 200);
    const circleId = useCanvasStore.getState().shapes[0].id;
    const circle = useCanvasStore.getState().shapes[0];
    if (circle.type !== "circle") throw new Error("unreachable");
    const origRx = circle.radiusX;
    const origRy = circle.radiusY;

    const ops: AIOperation[] = [{ type: "resizeObject", objectId: circleId, w: 200, h: 300 }];
    executeAIOperations(ops);
    const resized = useCanvasStore.getState().shapes[0];
    if (resized.type !== "circle") throw new Error("unreachable");
    expect(resized.radiusX).toBe(100); // w/2
    expect(resized.radiusY).toBe(150); // h/2

    useCanvasStore.getState().undo();
    const restored = useCanvasStore.getState().shapes[0];
    if (restored.type !== "circle") throw new Error("unreachable");
    expect(restored.radiusX).toBe(origRx);
    expect(restored.radiusY).toBe(origRy);
  });

  it("AI updateConnector is undoable", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    store.addCircle(400, 400);
    const [rect, circle] = useCanvasStore.getState().shapes;
    store.addConnector({ id: rect.id }, { id: circle.id }, "arrow");
    const connId = useCanvasStore.getState().shapes.find((s) => s.type === "connector")!.id;

    const ops: AIOperation[] = [
      { type: "updateConnector", objectId: connId, style: "double-arrow", lineStyle: "dashed" },
    ];
    executeAIOperations(ops);
    const updated = useCanvasStore.getState().shapes.find((s) => s.id === connId);
    if (!updated || updated.type !== "connector") throw new Error("unreachable");
    expect(updated.style).toBe("double-arrow");
    expect(updated.lineStyle).toBe("dashed");

    useCanvasStore.getState().undo();
    const restored = useCanvasStore.getState().shapes.find((s) => s.id === connId);
    if (!restored || restored.type !== "connector") throw new Error("unreachable");
    expect(restored.style).toBe("arrow");
    expect(restored.lineStyle).toBeUndefined();
  });

  it("empty AI operations array does not corrupt history", () => {
    const store = useCanvasStore.getState();
    store.addRect(100, 100);
    const historyLen = useCanvasStore.getState().history.length;

    // Executing empty ops still pushes history (by design)
    executeAIOperations([]);
    // One extra history entry from pushHistory, but shapes unchanged
    expect(useCanvasStore.getState().shapes).toHaveLength(1);

    useCanvasStore.getState().undo();
    // Should still have the rect (the "empty" AI op snapshot was same state)
    expect(useCanvasStore.getState().shapes).toHaveLength(1);
  });
});
