"use client";

import { useEffect } from "react";
import { useCanvasStore } from "@/store/canvas-store";
import { useDebugStore } from "@/store/debug-store";

/**
 * Keyboard shortcuts for the canvas.
 * Space = temporary hand tool, V = pointer, H = hand (sticky).
 */
export function useCanvasKeyboard({
  onSpaceDown,
  onSpaceUp,
}: {
  onSpaceDown: () => void;
  onSpaceUp: () => void;
}) {
  const deleteShapes = useCanvasStore((s) => s.deleteShapes);
  const selectAll = useCanvasStore((s) => s.selectAll);
  const copySelected = useCanvasStore((s) => s.copySelected);
  const paste = useCanvasStore((s) => s.paste);
  const duplicateShapes = useCanvasStore((s) => s.duplicateShapes);
  const updateShapes = useCanvasStore((s) => s.updateShapes);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const bringToFront = useCanvasStore((s) => s.bringToFront);
  const sendToBack = useCanvasStore((s) => s.sendToBack);
  const clearSelection = useCanvasStore((s) => s.clearSelection);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      // Space held → temporary hand mode
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        onSpaceDown();
        return;
      }

      // V key → pointer tool
      if (e.key === "v" && !e.metaKey && !e.ctrlKey) {
        useDebugStore.getState().setActiveTool("pointer");
        return;
      }

      // H key → hand tool (sticky)
      if (e.key === "h" && !e.metaKey && !e.ctrlKey) {
        useDebugStore.getState().setActiveTool("hand");
        return;
      }

      const meta = e.metaKey || e.ctrlKey;

      if ((e.key === "Delete" || e.key === "Backspace") && !meta) {
        e.preventDefault();
        const ids = useCanvasStore.getState().selectedIds;
        if (ids.length > 0) deleteShapes(ids);
        return;
      }

      if (meta && e.key === "a") {
        e.preventDefault();
        selectAll();
        return;
      }

      if (meta && e.key === "c") {
        e.preventDefault();
        copySelected();
        return;
      }

      if (meta && e.key === "v") {
        e.preventDefault();
        paste();
        return;
      }

      if (meta && e.key === "d") {
        e.preventDefault();
        const ids = useCanvasStore.getState().selectedIds;
        if (ids.length > 0) duplicateShapes(ids);
        return;
      }

      if (meta && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      if ((meta && e.shiftKey && e.key === "z") || (meta && e.key === "y")) {
        e.preventDefault();
        redo();
        return;
      }

      if (meta && e.key === "]") {
        e.preventDefault();
        const ids = useCanvasStore.getState().selectedIds;
        if (ids.length > 0) bringToFront(ids);
        return;
      }

      if (meta && e.key === "[") {
        e.preventDefault();
        const ids = useCanvasStore.getState().selectedIds;
        if (ids.length > 0) sendToBack(ids);
        return;
      }

      const NUDGE = e.shiftKey ? 10 : 1;
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        e.preventDefault();
        const ids = useCanvasStore.getState().selectedIds;
        const store = useCanvasStore.getState();
        if (ids.length === 0) return;
        store.pushHistory();
        const shapeById = new Map(store.shapes.map((shape) => [shape.id, shape]));
        const updates: Array<{ id: string; patch: { x: number; y: number } }> = [];
        for (const id of ids) {
          const shape = shapeById.get(id);
          if (!shape) continue;
          const dx =
            e.key === "ArrowLeft" ? -NUDGE : e.key === "ArrowRight" ? NUDGE : 0;
          const dy =
            e.key === "ArrowUp" ? -NUDGE : e.key === "ArrowDown" ? NUDGE : 0;
          updates.push({ id, patch: { x: shape.x + dx, y: shape.y + dy } });
        }
        updateShapes(updates);
        return;
      }

      if (e.key === "Escape") {
        clearSelection();
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        onSpaceUp();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    deleteShapes,
    selectAll,
    copySelected,
    paste,
    duplicateShapes,
    updateShapes,
    undo,
    redo,
    bringToFront,
    sendToBack,
    clearSelection,
    onSpaceDown,
    onSpaceUp,
  ]);
}
