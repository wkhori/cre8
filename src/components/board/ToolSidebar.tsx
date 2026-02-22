"use client";

import { useUIStore, type ActiveTool } from "@/store/ui-store";
import { useCanvasStore } from "@/store/canvas-store";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  MousePointer2,
  Hand,
  StickyNote,
  Square,
  Circle,
  Type,
  Frame,
  MoveRight,
  Undo2,
  Redo2,
  Keyboard,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

function ToolButton({
  icon: Icon,
  tool,
  shortcut,
  label,
}: {
  icon: LucideIcon;
  tool: ActiveTool;
  shortcut: string;
  label?: string;
}) {
  const activeTool = useUIStore((s) => s.activeTool);
  const setActiveTool = useUIStore((s) => s.setActiveTool);
  const isActive = activeTool === tool;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon-xs"
          variant={isActive ? "default" : "ghost"}
          onClick={() => setActiveTool(isActive ? "pointer" : tool)}
          className="size-8"
        >
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        <span className="text-xs">
          {label ?? tool.charAt(0).toUpperCase() + tool.slice(1)}{" "}
          <kbd className="ml-1 rounded bg-background/20 px-1 py-0.5 text-[10px] font-medium text-background/70">
            {shortcut}
          </kbd>
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

export default function ToolSidebar() {
  const connectorSourceSelected = useUIStore((s) => s.connectorSourceSelected);
  const activeTool = useUIStore((s) => s.activeTool);
  const historyIndex = useCanvasStore((s) => s.historyIndex);
  const historyLength = useCanvasStore((s) => s.history.length);
  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < historyLength - 2;

  return (
    <aside className="flex h-full w-11 shrink-0 flex-col items-center border-r border-zinc-200/80 bg-white/95 py-2 backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-950/95">
      <TooltipProvider delayDuration={150}>
        <div className="flex flex-col items-center gap-0.5">
          <ToolButton icon={MousePointer2} tool="pointer" shortcut="V" label="Pointer" />
          <ToolButton icon={Hand} tool="hand" shortcut="H" label="Hand" />
        </div>

        <Separator className="my-2 w-5" />

        <div className="flex flex-col items-center gap-0.5">
          <ToolButton icon={StickyNote} tool="place-sticky" shortcut="S" label="Sticky Note" />
          <ToolButton icon={Square} tool="place-rect" shortcut="R" label="Rectangle" />
          <ToolButton icon={Circle} tool="place-circle" shortcut="O" label="Circle" />
          <ToolButton icon={Type} tool="place-text" shortcut="T" label="Text" />
          <ToolButton icon={Frame} tool="draw-frame" shortcut="F" label="Frame" />
          <ToolButton icon={MoveRight} tool="connector" shortcut="C" label="Connector" />
        </div>

        {/* Connector status indicator */}
        {activeTool === "connector" && (
          <div className="mt-2 flex flex-col items-center">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
            <span className="mt-1 text-[8px] leading-tight text-blue-500">
              {connectorSourceSelected ? "target" : "source"}
            </span>
          </div>
        )}

        {/* Bottom section */}
        <div className="mt-auto flex flex-col items-center gap-0.5">
          <Separator className="mb-2 w-5" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => useCanvasStore.getState().undo()}
                disabled={!canUndo}
                className="size-8"
              >
                <Undo2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <span className="text-xs">
                Undo{" "}
                <kbd className="ml-1 rounded bg-background/20 px-1 py-0.5 text-[10px] font-medium text-background/70">
                  ⌘Z
                </kbd>
              </span>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => useCanvasStore.getState().redo()}
                disabled={!canRedo}
                className="size-8"
              >
                <Redo2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <span className="text-xs">
                Redo{" "}
                <kbd className="ml-1 rounded bg-background/20 px-1 py-0.5 text-[10px] font-medium text-background/70">
                  ⌘⇧Z
                </kbd>
              </span>
            </TooltipContent>
          </Tooltip>
          <Separator className="my-1 w-5" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => window.dispatchEvent(new Event("toggle-shortcuts"))}
                className="size-8"
              >
                <Keyboard className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <span className="text-xs">
                Shortcuts{" "}
                <kbd className="ml-1 rounded bg-background/20 px-1 py-0.5 text-[10px] font-medium text-background/70">
                  ?
                </kbd>
              </span>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </aside>
  );
}
