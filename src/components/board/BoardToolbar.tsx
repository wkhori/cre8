"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { useCanvasStore } from "@/store/canvas-store";
import { useDebugStore } from "@/store/debug-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Square,
  Circle,
  Type,
  StickyNote,
  Frame,
  MoveRight,
  ArrowRight,
  Minus,
  Undo2,
  Redo2,
  Trash2,
  Copy,
  ArrowUpToLine,
  ArrowDownToLine,
  MousePointer2,
  Hand,
  LogOut,
  Moon,
  Bug,
  ChevronLeft,
  Pencil,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import ColorPicker from "@/components/canvas/ColorPicker";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";

const PresenceBar = dynamic(() => import("@/components/presence/PresenceBar"), { ssr: false });

function getViewportCenter() {
  const vp = useDebugStore.getState().viewport;
  const w = typeof window !== "undefined" ? window.innerWidth : 800;
  const h = typeof window !== "undefined" ? window.innerHeight : 600;
  return {
    x: (w / 2 - vp.x) / vp.scale,
    y: (h / 2 - vp.y) / vp.scale,
  };
}

function ToolbarDivider() {
  return <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />;
}

interface BoardToolbarProps {
  boardId: string;
  boardName: string;
  onBoardNameChange: (name: string) => Promise<void>;
  user: User;
  profile: { name: string; photoURL: string | null };
  boardReady: boolean;
  showDebug: boolean;
  setShowDebug: (v: boolean) => void;
  actionLoading: boolean;
  signOut: () => Promise<void>;
}

function InlineBoardName({
  name,
  onSave,
}: {
  name: string;
  onSave: (name: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(name);
  }, [name]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const save = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) {
      onSave(trimmed);
    } else {
      setValue(name);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setValue(name);
            setEditing(false);
          }
          e.stopPropagation();
        }}
        className="h-6 w-40 rounded border border-zinc-300 bg-transparent px-1.5 text-sm font-medium text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-600 dark:text-zinc-100 dark:focus:border-zinc-400"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group/name flex items-center gap-1 rounded px-1 py-0.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
      title="Click to rename"
    >
      <span className="max-w-40 truncate">{name}</span>
      <Pencil className="size-3 opacity-0 group-hover/name:opacity-50" />
    </button>
  );
}

export default function BoardToolbar({
  boardId,
  boardName,
  onBoardNameChange,
  user,
  profile,
  boardReady,
  showDebug,
  setShowDebug,
  actionLoading,
  signOut,
}: BoardToolbarProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const shapes = useCanvasStore((s) => s.shapes);
  const historyIndex = useCanvasStore((s) => s.historyIndex);
  const historyLength = useCanvasStore((s) => s.history.length);
  const activeTool = useDebugStore((s) => s.activeTool);
  const setActiveTool = useDebugStore((s) => s.setActiveTool);

  const handleAddRect = useCallback(() => {
    const c = getViewportCenter();
    useCanvasStore.getState().addRect(c.x, c.y);
  }, []);

  const handleAddCircle = useCallback(() => {
    const c = getViewportCenter();
    useCanvasStore.getState().addCircle(c.x, c.y);
  }, []);

  const handleAddText = useCallback(() => {
    const c = getViewportCenter();
    const id = useCanvasStore.getState().addText(c.x, c.y);
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent("start-text-edit", { detail: { id } }));
    });
  }, []);

  const handleAddStickyNote = useCallback(() => {
    const c = getViewportCenter();
    const id = useCanvasStore.getState().addStickyNote(c.x, c.y);
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent("start-text-edit", { detail: { id } }));
    });
  }, []);

  const handleAddFrame = useCallback(() => {
    const c = getViewportCenter();
    useCanvasStore.getState().addFrame(c.x, c.y);
  }, []);

  const handleResetView = useCallback(() => {
    window.dispatchEvent(new CustomEvent("reset-canvas-view"));
  }, []);

  const hasSelection = selectedIds.length > 0;
  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < historyLength - 2;

  const selectedConnectors = shapes.filter(
    (s) => s.type === "connector" && selectedIds.includes(s.id)
  );
  const hasSelectedConnectors = selectedConnectors.length > 0;
  const allSelectedAreArrows =
    hasSelectedConnectors &&
    selectedConnectors.every((s) => s.type === "connector" && s.style === "arrow");

  return (
    <header className="sticky top-0 z-40 flex h-11 shrink-0 items-center border-b border-zinc-200/80 bg-white/90 px-3 backdrop-blur-lg dark:border-zinc-800/80 dark:bg-zinc-950/90">
      {/* Left: Logo + tool modes */}
      <div className="flex items-center gap-1">
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => router.push("/boards")}
          title="Back to boards"
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <Image
          src={theme === "dark" ? "/logo-dark.svg" : "/logo-light.svg"}
          alt="cre8"
          width={20}
          height={20}
          className="rounded-lg"
        />
        <InlineBoardName name={boardName} onSave={onBoardNameChange} />

        <ToolbarDivider />

        <Button
          size="icon-xs"
          variant={activeTool === "pointer" ? "default" : "ghost"}
          onClick={() => setActiveTool("pointer")}
          title="Pointer (V)"
        >
          <MousePointer2 className="size-3.5" />
        </Button>
        <Button
          size="icon-xs"
          variant={activeTool === "hand" ? "default" : "ghost"}
          onClick={() => setActiveTool("hand")}
          title="Hand (H)"
        >
          <Hand className="size-3.5" />
        </Button>

        <ToolbarDivider />

        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => useCanvasStore.getState().undo()}
          disabled={!canUndo}
          title="Undo (Cmd+Z)"
        >
          <Undo2 className="size-3.5" />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => useCanvasStore.getState().redo()}
          disabled={!canRedo}
          title="Redo (Cmd+Shift+Z)"
        >
          <Redo2 className="size-3.5" />
        </Button>

        <ToolbarDivider />

        <Button size="xs" variant="ghost" onClick={handleResetView} title="Reset view">
          Reset
        </Button>
      </div>

      {/* Center: Shape creators */}
      <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-zinc-200/80 bg-zinc-50/80 p-0.5 dark:border-zinc-800/80 dark:bg-zinc-900/80">
        <Button size="icon-xs" variant="ghost" onClick={handleAddStickyNote} title="Sticky Note">
          <StickyNote className="size-3.5" />
        </Button>
        <Button size="icon-xs" variant="ghost" onClick={handleAddRect} title="Rectangle">
          <Square className="size-3.5" />
        </Button>
        <Button size="icon-xs" variant="ghost" onClick={handleAddCircle} title="Circle">
          <Circle className="size-3.5" />
        </Button>
        <Button size="icon-xs" variant="ghost" onClick={handleAddText} title="Text">
          <Type className="size-3.5" />
        </Button>
        <Button size="icon-xs" variant="ghost" onClick={handleAddFrame} title="Frame">
          <Frame className="size-3.5" />
        </Button>
        <Button
          size="icon-xs"
          variant={activeTool === "connector" ? "default" : "ghost"}
          onClick={() => setActiveTool(activeTool === "connector" ? "pointer" : "connector")}
          title="Connector (C)"
        >
          <MoveRight className="size-3.5" />
        </Button>

        {hasSelection && (
          <>
            <ToolbarDivider />
            <ColorPicker />
            {hasSelectedConnectors && (
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => {
                  const newStyle = allSelectedAreArrows ? "line" : "arrow";
                  for (const c of selectedConnectors) {
                    useCanvasStore.getState().updateShape(c.id, { style: newStyle });
                  }
                }}
                title={allSelectedAreArrows ? "Switch to line" : "Switch to arrow"}
              >
                {allSelectedAreArrows ? (
                  <Minus className="size-3.5" />
                ) : (
                  <ArrowRight className="size-3.5" />
                )}
              </Button>
            )}
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
        )}
      </div>

      {/* Right: Presence + user */}
      <div className="ml-auto flex items-center gap-2">
        {hasSelection && (
          <span className="text-[11px] tabular-nums text-zinc-500">
            {selectedIds.length} selected
          </span>
        )}

        {boardReady && <PresenceBar boardId={boardId} myUid={user.uid} />}

        <ToolbarDivider />

        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {profile?.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.photoURL}
                  alt={profile.name}
                  className="size-7 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-700"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex size-7 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                  {(profile?.name ?? user.email ?? "U").slice(0, 1).toUpperCase()}
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{profile?.name ?? "User"}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <DropdownMenuSeparator />
            <div
              className="flex items-center justify-between px-2 py-1.5"
              onClick={(e) => e.preventDefault()}
            >
              <div className="flex items-center gap-2 text-sm">
                <Moon className="size-4" />
                Dark mode
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              />
            </div>
            <div
              className="flex items-center justify-between px-2 py-1.5"
              onClick={(e) => e.preventDefault()}
            >
              <div className="flex items-center gap-2 text-sm">
                <Bug className="size-4" />
                Dev mode
              </div>
              <Switch checked={showDebug} onCheckedChange={setShowDebug} />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => void signOut()}
              disabled={actionLoading}
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
