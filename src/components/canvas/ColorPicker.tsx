"use client";

import { useState } from "react";
import { useCanvasStore } from "@/store/canvas-store";
import type { Shape } from "@/lib/types";
import {
  ROW_1_COLORS,
  ROW_2_COLORS,
  getColorField,
  getShapeColor,
  isLightColor,
} from "@/lib/colors";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ColorPicker() {
  const [open, setOpen] = useState(false);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const shapes = useCanvasStore((s) => s.shapes);

  const selectedShapes = shapes.filter((s) => selectedIds.includes(s.id));
  if (selectedShapes.length === 0) return null;

  // Current color from first selected shape
  const currentColor = getShapeColor(selectedShapes[0]);
  // Check if all selected shapes share the same color
  const allSameColor = selectedShapes.every((s) => getShapeColor(s) === currentColor);

  function applyColor(hex: string) {
    const store = useCanvasStore.getState();
    store.pushHistory();

    const updates: Array<{ id: string; patch: Partial<Shape> }> = [];
    for (const id of selectedIds) {
      const shape = store.shapes.find((s) => s.id === id);
      if (!shape) continue;
      const field = getColorField(shape.type);
      updates.push({ id, patch: { [field]: hex } as Partial<Shape> });
    }

    store.updateShapes(updates);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex size-6 items-center justify-center rounded-md outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          title="Color"
        >
          <span
            className="size-4 rounded-full ring-1 ring-black/15 dark:ring-white/20"
            style={{ backgroundColor: currentColor }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" sideOffset={8} className="w-auto p-2">
        {/* Row 1: Bold / saturated (10) */}
        <div className="flex gap-1">
          {ROW_1_COLORS.map((hex) => (
            <Swatch
              key={hex}
              hex={hex}
              isActive={allSameColor && currentColor === hex}
              onClick={() => applyColor(hex)}
            />
          ))}
        </div>
        {/* Row 2: Soft / pastel (10) */}
        <div className="mt-1 flex gap-1">
          {ROW_2_COLORS.map((hex) => (
            <Swatch
              key={hex}
              hex={hex}
              isActive={allSameColor && currentColor === hex}
              onClick={() => applyColor(hex)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Swatch({
  hex,
  isActive,
  onClick,
}: {
  hex: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const light = isLightColor(hex);

  return (
    <button
      className={cn(
        "relative flex size-6 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "ring-1 ring-black/10 dark:ring-white/15",
        isActive && "ring-2 ring-primary"
      )}
      style={{ backgroundColor: hex }}
      onClick={onClick}
      title={hex}
    >
      {isActive && (
        <Check className={cn("size-3 stroke-3", light ? "text-zinc-800" : "text-white")} />
      )}
    </button>
  );
}
