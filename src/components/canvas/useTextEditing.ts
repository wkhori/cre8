"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import type Konva from "konva";
import type { Shape } from "@/lib/types";
import { useCanvasStore } from "@/store/canvas-store";
import { useUIStore } from "@/store/ui-store";
import { computeStickyFontSize, STICKY_PAD_X, STICKY_PAD_Y } from "@/lib/sticky-text";
import { isLightColor } from "@/lib/colors";

export function useTextEditing(stageRef: React.RefObject<Konva.Stage | null>, shapes: Shape[]) {
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState("");
  const editingShapeTypeRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const viewport = useUIStore((s) => s.viewport);

  const beginTextEditing = useCallback(
    (id: string) => {
      const shape = useCanvasStore.getState().shapes.find((s) => s.id === id);
      if (!shape) return;
      if (shape.type !== "text" && shape.type !== "sticky" && shape.type !== "frame") return;

      editingShapeTypeRef.current = shape.type;
      setEditingTextId(id);
      const currentText = shape.type === "frame" ? shape.title : shape.text;
      setEditingTextValue(currentText);

      const stage = stageRef.current;
      if (stage) {
        const node = stage.findOne(`#${id}`);
        if (node) {
          if (shape.type === "sticky" || shape.type === "frame") {
            const group = node as Konva.Group;
            const textChild = group.findOne("Text");
            if (textChild) textChild.visible(false);
          } else {
            node.visible(false);
          }
          stage.batchDraw();
        }
      }

      const isDefault =
        (shape.type === "text" && currentText === "Text") ||
        (shape.type === "frame" && currentText === "Frame");
      setTimeout(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.focus();
        if (isDefault) {
          ta.select();
        } else {
          ta.selectionStart = ta.selectionEnd = currentText.length;
        }
      }, 0);
    },
    [stageRef]
  );

  const handleShapeDblClick = useCallback(
    (id: string) => {
      beginTextEditing(id);
    },
    [beginTextEditing]
  );

  // Listen for custom "start-text-edit" events (e.g. from toolbar shape creation)
  useEffect(() => {
    const onStartTextEdit = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ id?: string }>;
      const id = customEvt.detail?.id;
      if (!id) return;
      beginTextEditing(id);
    };

    window.addEventListener("start-text-edit", onStartTextEdit as EventListener);
    return () => window.removeEventListener("start-text-edit", onStartTextEdit as EventListener);
  }, [beginTextEditing]);

  const restoreEditingNode = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || !editingTextId) return;
    const node = stage.findOne(`#${editingTextId}`);
    if (node) {
      if (editingShapeTypeRef.current === "sticky" || editingShapeTypeRef.current === "frame") {
        const group = node as Konva.Group;
        const textChild = group.findOne("Text");
        if (textChild) textChild.visible(true);
      } else {
        node.visible(true);
      }
      stage.batchDraw();
    }
  }, [editingTextId, stageRef]);

  const commitTextEdit = useCallback(() => {
    if (!editingTextId) return;
    const store = useCanvasStore.getState();
    const shapeType = editingShapeTypeRef.current;
    store.pushHistory();
    if (shapeType === "frame") {
      store.updateShape(editingTextId, { title: editingTextValue || "Frame" });
    } else {
      store.updateShape(editingTextId, {
        text: editingTextValue || (shapeType === "sticky" ? "" : "Text"),
      });
    }

    restoreEditingNode();

    editingShapeTypeRef.current = null;
    setEditingTextId(null);
    setEditingTextValue("");
  }, [editingTextId, editingTextValue, restoreEditingNode]);

  const cancelTextEdit = useCallback(() => {
    restoreEditingNode();
    editingShapeTypeRef.current = null;
    setEditingTextId(null);
    setEditingTextValue("");
  }, [restoreEditingNode]);

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setEditingTextValue(val);
      if (editingTextId) {
        const field = editingShapeTypeRef.current === "frame" ? "title" : "text";
        useCanvasStore.getState().updateShape(editingTextId, { [field]: val });
      }
    },
    [editingTextId]
  );

  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
        cancelTextEdit();
      }
    },
    [commitTextEdit, cancelTextEdit]
  );

  // Compute textarea position for the editing shape
  const editingTextStyle = useMemo(() => {
    if (!editingTextId) return null;
    const shape = shapes.find((s) => s.id === editingTextId);
    if (!shape) return null;

    if (shape.type === "text") {
      const x = shape.x * viewport.scale + viewport.x;
      const y = shape.y * viewport.scale + viewport.y;
      const width = (shape.width ?? 200) * viewport.scale;
      const fontSize = shape.fontSize * viewport.scale;
      const fs = shape.fontStyle ?? "normal";
      return {
        position: "absolute" as const,
        left: x,
        top: y,
        width,
        minHeight: fontSize + 4,
        fontSize,
        fontFamily: shape.fontFamily,
        fontWeight: fs.includes("bold") ? "bold" : ("normal" as const),
        fontStyle: fs.includes("italic") ? "italic" : ("normal" as const),
        color: shape.fill,
        border: "none",
        borderRadius: 0,
        background: "transparent",
        outline: "none",
        resize: "none" as const,
        padding: 0,
        margin: 0,
        lineHeight: 1.2,
        overflow: "hidden" as const,
        zIndex: 100,
      };
    }

    if (shape.type === "sticky") {
      const x = (shape.x + STICKY_PAD_X) * viewport.scale + viewport.x;
      const y = (shape.y + STICKY_PAD_Y) * viewport.scale + viewport.y;
      const availW = shape.w - STICKY_PAD_X * 2;
      const availH = shape.h - STICKY_PAD_Y * 2;
      const width = availW * viewport.scale;
      const height = availH * viewport.scale;
      const baseFontSize = computeStickyFontSize(
        editingTextValue || shape.text,
        availW,
        availH,
        shape.fontSize ?? 16
      );
      const fontSize = baseFontSize * viewport.scale;
      const sfs = shape.fontStyle ?? "normal";
      const textColor = isLightColor(shape.color) ? "#18181b" : "#fafafa";
      return {
        position: "absolute" as const,
        left: x,
        top: y,
        width,
        height,
        fontSize,
        fontFamily: "system-ui, sans-serif",
        fontWeight: sfs.includes("bold") ? "bold" : ("normal" as const),
        fontStyle: sfs.includes("italic") ? "italic" : ("normal" as const),
        color: textColor,
        border: "none",
        borderRadius: 0,
        background: "transparent",
        outline: "none",
        boxShadow: "inset 0 0 0 2px #3b82f6",
        resize: "none" as const,
        padding: 0,
        margin: 0,
        lineHeight: 1.4,
        overflowY: "auto" as const,
        overflowX: "hidden" as const,
        zIndex: 100,
        wordBreak: "break-word" as const,
      };
    }

    if (shape.type === "frame") {
      const x = (shape.x + 8) * viewport.scale + viewport.x;
      const y = (shape.y - 20) * viewport.scale + viewport.y;
      const fontSize = 13 * viewport.scale;
      const width = Math.max((shape.w - 16) * viewport.scale, 60);
      return {
        position: "absolute" as const,
        left: x,
        top: y,
        width,
        height: fontSize + 6,
        fontSize,
        fontFamily: "system-ui, sans-serif",
        color: "#71717a",
        border: "none",
        borderRadius: 2,
        background: "transparent",
        outline: "none",
        boxShadow: "0 0 0 1px #3b82f6",
        resize: "none" as const,
        padding: 0,
        margin: 0,
        lineHeight: 1.2,
        overflow: "hidden" as const,
        zIndex: 100,
      };
    }

    return null;
  }, [editingTextId, shapes, viewport]);

  return {
    editingTextId,
    editingTextValue,
    editingTextStyle,
    textareaRef,
    beginTextEditing,
    handleShapeDblClick,
    commitTextEdit,
    cancelTextEdit,
    setEditingTextValue,
    handleTextareaChange,
    handleTextareaKeyDown,
  };
}
