"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { useCanvasStore } from "@/store/canvas-store";
import { useUIStore } from "@/store/ui-store";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Bold,
  Italic,
  Underline,
  Minus,
  ArrowRight,
  Copy,
  ArrowUpToLine,
  ArrowDownToLine,
  Trash2,
  ChevronDown,
} from "lucide-react";
import ColorPicker from "@/components/canvas/ColorPicker";
import { getShapeBounds, computeConnectorPoints } from "@/lib/shape-geometry";
import { cn } from "@/lib/utils";
import type { Shape, ConnectorShape } from "@/lib/types";

// ── Font families ─────────────────────────────────────────────────────
const FONT_FAMILIES = [
  { label: "Sans", value: "Inter, system-ui, sans-serif" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Mono", value: "'Courier New', monospace" },
  { label: "Hand", value: "cursive" },
] as const;

function getFontLabel(fontFamily: string | undefined): string {
  if (!fontFamily) return "Sans";
  const match = FONT_FAMILIES.find((f) => f.value === fontFamily);
  if (match) return match.label;
  if (fontFamily.includes("serif") && !fontFamily.includes("sans")) return "Serif";
  if (fontFamily.includes("mono") || fontFamily.includes("Courier")) return "Mono";
  if (fontFamily.includes("cursive")) return "Hand";
  return "Sans";
}

// ── Line styles ───────────────────────────────────────────────────────
const LINE_STYLES = [
  { label: "Solid", value: "solid" as const },
  { label: "Dashed", value: "dashed" as const },
  { label: "Dotted", value: "dotted" as const },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────
function toggleFontStyle(
  current: string | undefined,
  toggle: "bold" | "italic"
): "normal" | "bold" | "italic" | "bold italic" {
  const cur = current ?? "normal";
  const hasBold = cur.includes("bold");
  const hasItalic = cur.includes("italic");
  let newBold = hasBold;
  let newItalic = hasItalic;
  if (toggle === "bold") newBold = !newBold;
  if (toggle === "italic") newItalic = !newItalic;
  if (newBold && newItalic) return "bold italic";
  if (newBold) return "bold";
  if (newItalic) return "italic";
  return "normal";
}

const TOOLBAR_GAP = 12;

export default function FloatingToolbar() {
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const shapes = useCanvasStore((s) => s.shapes);
  const interaction = useUIStore((s) => s.interaction);
  const viewport = useUIStore((s) => s.viewport);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarWidth, setToolbarWidth] = useState(0);

  useEffect(() => {
    if (toolbarRef.current) {
      setToolbarWidth(toolbarRef.current.offsetWidth);
    }
  });

  // Don't render during interactions or when nothing selected
  if (selectedIds.length === 0 || interaction !== "idle") return null;

  const selectedShapes = shapes.filter((s) => selectedIds.includes(s.id));
  if (selectedShapes.length === 0) return null;

  // ── Position calculation ──────────────────────────────────────────
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const shape of selectedShapes) {
    if (shape.type === "connector") {
      // Connectors use absolute world coords from computeConnectorPoints
      const pts = computeConnectorPoints(shape, shapes);
      for (let i = 0; i < pts.length; i += 2) {
        minX = Math.min(minX, pts[i]);
        minY = Math.min(minY, pts[i + 1]);
        maxX = Math.max(maxX, pts[i]);
        maxY = Math.max(maxY, pts[i + 1]);
      }
    } else {
      const b = getShapeBounds(shape);
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    }
  }

  const screenTop = minY * viewport.scale + viewport.y;
  const screenBottom = maxY * viewport.scale + viewport.y;
  const screenCenterX = ((minX + maxX) / 2) * viewport.scale + viewport.x;

  // Position above selection; flip below if not enough room
  const aboveY = screenTop - TOOLBAR_GAP - 40;
  const belowY = screenBottom + TOOLBAR_GAP;
  const top = aboveY > 8 ? aboveY : belowY;
  const halfW = toolbarWidth / 2 || 200;
  const left = Math.max(8, Math.min(screenCenterX - halfW, window.innerWidth - halfW * 2 - 8));

  // ── Shape analysis ────────────────────────────────────────────────
  const selectedConnectors = selectedShapes.filter(
    (s): s is ConnectorShape => s.type === "connector"
  );
  const hasSelectedConnectors = selectedConnectors.length > 0;
  const selectedTexts = selectedShapes.filter((s) => s.type === "text" || s.type === "sticky");
  const hasSelectedTexts = selectedTexts.length > 0;

  // Font state
  const firstText = selectedTexts[0];
  const currentFontStyle =
    firstText?.type === "text" || firstText?.type === "sticky" ? firstText.fontStyle : undefined;
  const currentFontSize =
    firstText?.type === "text"
      ? firstText.fontSize
      : firstText?.type === "sticky"
        ? (firstText.fontSize ?? 16)
        : 16;
  const currentFontFamily =
    firstText?.type === "text"
      ? firstText.fontFamily
      : firstText?.type === "sticky"
        ? firstText.fontFamily
        : undefined;
  const currentTextDecoration =
    firstText?.type === "text" || firstText?.type === "sticky"
      ? firstText.textDecoration
      : undefined;

  const isBold = (currentFontStyle ?? "normal").includes("bold");
  const isItalic = (currentFontStyle ?? "normal").includes("italic");
  const isUnderline = currentTextDecoration === "underline";

  // Connector state
  const allSelectedAreArrows =
    hasSelectedConnectors && selectedConnectors.every((s) => s.style === "arrow");
  const allSelectedAreLines =
    hasSelectedConnectors && selectedConnectors.every((s) => s.style === "line");
  const currentLineStyle = hasSelectedConnectors
    ? (selectedConnectors[0].lineStyle ?? "solid")
    : "solid";
  const currentStrokeWidth = hasSelectedConnectors ? selectedConnectors[0].strokeWidth : 2;

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div
        ref={toolbarRef}
        className="pointer-events-auto absolute flex items-center gap-0.5 rounded-xl border border-zinc-200/80 bg-white/95 px-1.5 py-1 shadow-lg backdrop-blur-md dark:border-zinc-700/80 dark:bg-zinc-900/95 dark:shadow-zinc-950/50"
        style={{ top, left }}
      >
        {/* Color picker */}
        <ColorPicker />

        <Separator orientation="vertical" className="mx-0.5 h-5" />

        {/* Text formatting controls */}
        {hasSelectedTexts && (
          <TextControls
            selectedTexts={selectedTexts}
            isBold={isBold}
            isItalic={isItalic}
            isUnderline={isUnderline}
            currentFontSize={currentFontSize}
            currentFontFamily={currentFontFamily}
          />
        )}

        {/* Connector controls */}
        {hasSelectedConnectors && (
          <ConnectorControls
            selectedConnectors={selectedConnectors}
            allSelectedAreArrows={allSelectedAreArrows}
            allSelectedAreLines={allSelectedAreLines}
            currentLineStyle={currentLineStyle}
            currentStrokeWidth={currentStrokeWidth}
          />
        )}

        {(hasSelectedTexts || hasSelectedConnectors) && (
          <Separator orientation="vertical" className="mx-0.5 h-5" />
        )}

        {/* Common actions */}
        <ActionButtons selectedIds={selectedIds} />
      </div>
    </div>
  );
}

// ── Text Controls ─────────────────────────────────────────────────────
function TextControls({
  selectedTexts,
  isBold,
  isItalic,
  isUnderline,
  currentFontSize,
  currentFontFamily,
}: {
  selectedTexts: Shape[];
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  currentFontSize: number;
  currentFontFamily: string | undefined;
}) {
  const [fontFamilyOpen, setFontFamilyOpen] = useState(false);

  const applyFontStyle = useCallback(
    (toggle: "bold" | "italic") => {
      const store = useCanvasStore.getState();
      store.pushHistory();
      const updates: Array<{ id: string; patch: Partial<Shape> }> = [];
      for (const s of selectedTexts) {
        const fs = s.type === "text" || s.type === "sticky" ? s.fontStyle : undefined;
        updates.push({
          id: s.id,
          patch: { fontStyle: toggleFontStyle(fs, toggle) } as Partial<Shape>,
        });
      }
      store.updateShapes(updates);
    },
    [selectedTexts]
  );

  const applyTextDecoration = useCallback(
    (decoration: "none" | "underline") => {
      const store = useCanvasStore.getState();
      store.pushHistory();
      const updates: Array<{ id: string; patch: Partial<Shape> }> = [];
      for (const s of selectedTexts) {
        updates.push({
          id: s.id,
          patch: { textDecoration: decoration } as Partial<Shape>,
        });
      }
      store.updateShapes(updates);
    },
    [selectedTexts]
  );

  const applyFontSize = useCallback(
    (size: number) => {
      const clamped = Math.max(8, Math.min(200, size));
      const store = useCanvasStore.getState();
      store.pushHistory();
      const updates: Array<{ id: string; patch: Partial<Shape> }> = [];
      for (const s of selectedTexts) {
        updates.push({
          id: s.id,
          patch: { fontSize: clamped } as Partial<Shape>,
        });
      }
      store.updateShapes(updates);
    },
    [selectedTexts]
  );

  const applyFontFamily = useCallback(
    (family: string) => {
      const store = useCanvasStore.getState();
      store.pushHistory();
      const updates: Array<{ id: string; patch: Partial<Shape> }> = [];
      for (const s of selectedTexts) {
        updates.push({
          id: s.id,
          patch: { fontFamily: family } as Partial<Shape>,
        });
      }
      store.updateShapes(updates);
      setFontFamilyOpen(false);
    },
    [selectedTexts]
  );

  return (
    <>
      {/* Font family picker */}
      <Popover open={fontFamilyOpen} onOpenChange={setFontFamilyOpen}>
        <PopoverTrigger asChild>
          <button
            className="flex h-7 items-center gap-0.5 rounded-md px-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            title="Font family"
          >
            {getFontLabel(currentFontFamily)}
            <ChevronDown className="size-3 text-zinc-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" sideOffset={8} className="w-36 p-1">
          {FONT_FAMILIES.map((f) => (
            <button
              key={f.value}
              onClick={() => applyFontFamily(f.value)}
              className={cn(
                "flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800",
                getFontLabel(currentFontFamily) === f.label &&
                  "bg-zinc-100 font-medium dark:bg-zinc-800"
              )}
              style={{ fontFamily: f.value }}
            >
              {f.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="mx-0.5 h-5" />

      {/* Font size: -/input/+ */}
      <div className="flex items-center gap-px">
        <button
          onClick={() => applyFontSize(currentFontSize - 2)}
          className="flex size-6 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          title="Decrease font size"
        >
          <Minus className="size-3" />
        </button>
        <input
          type="number"
          value={currentFontSize}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v)) applyFontSize(v);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          className="h-6 w-9 rounded border border-zinc-200 bg-transparent text-center text-xs tabular-nums text-zinc-700 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:focus:border-zinc-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          min={8}
          max={200}
        />
        <button
          onClick={() => applyFontSize(currentFontSize + 2)}
          className="flex size-6 items-center justify-center rounded text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          title="Increase font size"
        >
          +
        </button>
      </div>

      <Separator orientation="vertical" className="mx-0.5 h-5" />

      {/* Bold / Italic / Underline */}
      <Button
        size="icon-xs"
        variant={isBold ? "default" : "ghost"}
        onClick={() => applyFontStyle("bold")}
        title="Bold"
      >
        <Bold className="size-3.5" />
      </Button>
      <Button
        size="icon-xs"
        variant={isItalic ? "default" : "ghost"}
        onClick={() => applyFontStyle("italic")}
        title="Italic"
      >
        <Italic className="size-3.5" />
      </Button>
      <Button
        size="icon-xs"
        variant={isUnderline ? "default" : "ghost"}
        onClick={() => applyTextDecoration(isUnderline ? "none" : "underline")}
        title="Underline"
      >
        <Underline className="size-3.5" />
      </Button>
    </>
  );
}

// ── Connector Controls ────────────────────────────────────────────────
function ConnectorControls({
  selectedConnectors,
  allSelectedAreArrows,
  allSelectedAreLines,
  currentLineStyle,
  currentStrokeWidth,
}: {
  selectedConnectors: ConnectorShape[];
  allSelectedAreArrows: boolean;
  allSelectedAreLines: boolean;
  currentLineStyle: string;
  currentStrokeWidth: number;
}) {
  const [styleOpen, setStyleOpen] = useState(false);

  const applyConnectorStyle = useCallback(
    (style: "line" | "arrow") => {
      const store = useCanvasStore.getState();
      store.pushHistory();
      const updates = selectedConnectors.map((c) => ({
        id: c.id,
        patch: { style } as Partial<Shape>,
      }));
      store.updateShapes(updates);
    },
    [selectedConnectors]
  );

  const applyLineStyle = useCallback(
    (lineStyle: "solid" | "dashed" | "dotted") => {
      const store = useCanvasStore.getState();
      store.pushHistory();
      const updates = selectedConnectors.map((c) => ({
        id: c.id,
        patch: { lineStyle } as Partial<Shape>,
      }));
      store.updateShapes(updates);
    },
    [selectedConnectors]
  );

  const applyStrokeWidth = useCallback(
    (strokeWidth: number) => {
      const store = useCanvasStore.getState();
      store.pushHistory();
      const updates = selectedConnectors.map((c) => ({
        id: c.id,
        patch: { strokeWidth } as Partial<Shape>,
      }));
      store.updateShapes(updates);
    },
    [selectedConnectors]
  );

  // Current style label for the trigger button
  const endpointLabel = allSelectedAreArrows ? "Arrow" : allSelectedAreLines ? "Line" : "Mixed";
  const lineLabel = LINE_STYLES.find((ls) => ls.value === currentLineStyle)?.label ?? "Solid";

  return (
    <>
      {/* Endpoint style: line / arrow */}
      <Button
        size="icon-xs"
        variant={allSelectedAreLines ? "default" : "ghost"}
        onClick={() => applyConnectorStyle("line")}
        title="Line (no arrow)"
      >
        <Minus className="size-3.5" />
      </Button>
      <Button
        size="icon-xs"
        variant={allSelectedAreArrows ? "default" : "ghost"}
        onClick={() => applyConnectorStyle("arrow")}
        title="Arrow"
      >
        <ArrowRight className="size-3.5" />
      </Button>

      <Separator orientation="vertical" className="mx-0.5 h-5" />

      {/* Line style + stroke width dropdown */}
      <Popover open={styleOpen} onOpenChange={setStyleOpen}>
        <PopoverTrigger asChild>
          <button
            className="flex h-7 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            title="Line style"
          >
            <svg width="18" height="2" viewBox="0 0 18 2" className="mr-0.5">
              <line
                x1="0"
                y1="1"
                x2="18"
                y2="1"
                className="stroke-current text-zinc-600 dark:text-zinc-300"
                strokeWidth="2"
                strokeDasharray={
                  currentLineStyle === "dashed"
                    ? "4,3"
                    : currentLineStyle === "dotted"
                      ? "1,3"
                      : "none"
                }
                strokeLinecap="round"
              />
            </svg>
            {lineLabel}
            <ChevronDown className="size-3 text-zinc-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" sideOffset={8} className="w-40 p-1.5">
          {/* Line style section */}
          <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Style
          </p>
          {LINE_STYLES.map((ls) => (
            <button
              key={ls.value}
              onClick={() => applyLineStyle(ls.value)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                "hover:bg-zinc-100 dark:hover:bg-zinc-800",
                currentLineStyle === ls.value && "bg-zinc-100 font-medium dark:bg-zinc-800"
              )}
            >
              <svg width="24" height="2" viewBox="0 0 24 2" className="shrink-0">
                <line
                  x1="0"
                  y1="1"
                  x2="24"
                  y2="1"
                  className="stroke-current text-zinc-600 dark:text-zinc-300"
                  strokeWidth="2"
                  strokeDasharray={
                    ls.value === "dashed" ? "5,3" : ls.value === "dotted" ? "1,3" : "none"
                  }
                  strokeLinecap="round"
                />
              </svg>
              {ls.label}
            </button>
          ))}

          <Separator className="my-1.5" />

          {/* Stroke width section */}
          <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Weight
          </p>
          {[
            { w: 1, label: "Thin" },
            { w: 2, label: "Regular" },
            { w: 4, label: "Thick" },
          ].map(({ w, label }) => (
            <button
              key={w}
              onClick={() => applyStrokeWidth(w)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                "hover:bg-zinc-100 dark:hover:bg-zinc-800",
                currentStrokeWidth === w && "bg-zinc-100 font-medium dark:bg-zinc-800"
              )}
            >
              <div className="flex w-6 items-center justify-center">
                <div
                  className="rounded-full bg-zinc-600 dark:bg-zinc-300"
                  style={{ width: 18, height: Math.max(w, 1) }}
                />
              </div>
              {label}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </>
  );
}

// ── Action Buttons ────────────────────────────────────────────────────
function ActionButtons({ selectedIds }: { selectedIds: string[] }) {
  return (
    <>
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={() => useCanvasStore.getState().duplicateShapes(selectedIds)}
        title="Duplicate (Cmd+D)"
      >
        <Copy className="size-3.5" />
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={() => useCanvasStore.getState().bringToFront(selectedIds)}
        title="Bring to Front"
      >
        <ArrowUpToLine className="size-3.5" />
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={() => useCanvasStore.getState().sendToBack(selectedIds)}
        title="Send to Back"
      >
        <ArrowDownToLine className="size-3.5" />
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
        onClick={() => useCanvasStore.getState().deleteShapes(selectedIds)}
        title="Delete (Backspace)"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </>
  );
}
