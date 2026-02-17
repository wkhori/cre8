"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useCanvasStore } from "@/store/canvas-store";
import { useDebugStore } from "@/store/debug-store";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  subscribeBoardObjects,
  createObject,
  deleteObjects,
  updateObjects,
  getOrCreateBoard,
  createLiveDragBroadcaster,
  subscribeLiveDrags,
  type LiveDragData,
  type BoardObjectChange,
} from "@/lib/sync";
import {
  joinBoard,
  createCursorBroadcaster,
} from "@/lib/presence";
import type { Shape } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Square,
  Circle,
  Type,
  StickyNote,
  Frame,
  Undo2,
  Redo2,
  Trash2,
  Copy,
  ArrowUpToLine,
  ArrowDownToLine,
  MousePointer2,
  Hand,
  Loader2,
  LogOut,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const CanvasStage = dynamic(
  () => import("@/components/canvas/CanvasStage"),
  { ssr: false }
);
const DebugDashboard = dynamic(
  () => import("@/components/debug/DebugDashboard"),
  { ssr: false }
);
const PresenceBar = dynamic(
  () => import("@/components/presence/PresenceBar"),
  { ssr: false }
);

function getViewportCenter() {
  const vp = useDebugStore.getState().viewport;
  const w = typeof window !== "undefined" ? window.innerWidth : 800;
  const h = typeof window !== "undefined" ? window.innerHeight : 600;
  return {
    x: (w / 2 - vp.x) / vp.scale,
    y: (h / 2 - vp.y) / vp.scale,
  };
}

export default function BoardPage() {
  const router = useRouter();
  const params = useParams();
  const boardId = params.id as string;

  const { user, profile, loading: authLoading, actionLoading, signOut } = useAuth();

  const shapes = useCanvasStore((s) => s.shapes);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const historyIndex = useCanvasStore((s) => s.historyIndex);
  const historyLength = useCanvasStore((s) => s.history.length);
  const activeTool = useDebugStore((s) => s.activeTool);
  const setActiveTool = useDebugStore((s) => s.setActiveTool);

  const [boardReady, setBoardReady] = useState(false);
  const cursorBroadcasterRef = useRef<ReturnType<typeof createCursorBroadcaster> | null>(null);
  const liveDragBroadcasterRef = useRef<ReturnType<typeof createLiveDragBroadcaster> | null>(null);
  const isSyncingRef = useRef(0); // counter: >0 means we're applying remote changes
  // Track which shape IDs we know exist in Firestore (to avoid duplicate creates)
  const remoteShapeIdsRef = useRef<Set<string>>(new Set());
  // IDs recently updated from Firestore — skip writing these back
  const recentSyncedIdsRef = useRef<Set<string>>(new Set());
  // Track live drag overlay from remote users
  const liveDragsRef = useRef<LiveDragData>({});

  // ── Initialize board + sync ────────────────────────────────────────
  useEffect(() => {
    if (!user || !profile || !boardId) return;

    let unsubObjects: (() => void) | null = null;
    let unsubLiveDrags: (() => void) | null = null;
    let leaveBoard: (() => void) | null = null;

    const init = async () => {
      // Ensure board document exists
      await getOrCreateBoard(boardId, user.uid);

      // Subscribe to board objects from Firestore (incremental)
      // All changes in a single snapshot are batched into one store update
      // to avoid cascading re-renders and sync loops.
      unsubObjects = subscribeBoardObjects(boardId, {
        onInitial: (remoteShapes) => {
          isSyncingRef.current++;
          remoteShapeIdsRef.current = new Set(remoteShapes.map((s) => s.id));
          for (const s of remoteShapes) recentSyncedIdsRef.current.add(s.id);
          useCanvasStore.getState().setShapes(remoteShapes);
          isSyncingRef.current--;
        },
        onChanges: (changes: BoardObjectChange[]) => {
          isSyncingRef.current++;
          const store = useCanvasStore.getState();
          const currentShapes = store.shapes;
          const currentMap = new Map(currentShapes.map((s) => [s.id, s]));

          let newShapes = [...currentShapes];
          let selectedIds = [...store.selectedIds];

          for (const change of changes) {
            recentSyncedIdsRef.current.add(change.shape.id);

            switch (change.type) {
              case "added":
                remoteShapeIdsRef.current.add(change.shape.id);
                if (currentMap.has(change.shape.id)) {
                  // Already exists locally, update it
                  newShapes = newShapes.map((s) =>
                    s.id === change.shape.id ? { ...s, ...change.shape } : s
                  );
                } else {
                  newShapes.push(change.shape);
                }
                break;
              case "modified":
                newShapes = newShapes.map((s) =>
                  s.id === change.shape.id ? { ...s, ...change.shape } : s
                );
                break;
              case "removed":
                remoteShapeIdsRef.current.delete(change.shape.id);
                newShapes = newShapes.filter((s) => s.id !== change.shape.id);
                selectedIds = selectedIds.filter((id) => id !== change.shape.id);
                break;
            }
          }

          // Single store update for the entire batch
          store.setShapes(newShapes);
          if (selectedIds.length !== store.selectedIds.length) {
            store.setSelected(selectedIds);
          }
          isSyncingRef.current--;
        },
      });

      // Subscribe to live drag positions from remote users
      unsubLiveDrags = subscribeLiveDrags(boardId, user.uid, (drags) => {
        liveDragsRef.current = drags;
        // Apply remote drag positions to local shapes as overlays
        isSyncingRef.current++;
        const store = useCanvasStore.getState();
        const updates: Array<{ id: string; patch: Partial<Shape> }> = [];
        for (const [id, data] of Object.entries(drags)) {
          if (store.shapes.find((s) => s.id === id)) {
            updates.push({ id, patch: { x: data.x, y: data.y } });
            recentSyncedIdsRef.current.add(id);
          }
        }
        if (updates.length > 0) {
          store.updateShapes(updates);
        }
        isSyncingRef.current--;
      });

      // Create live drag broadcaster
      liveDragBroadcasterRef.current = createLiveDragBroadcaster(boardId, user.uid);

      // Join presence
      leaveBoard = joinBoard(
        boardId,
        user.uid,
        profile.name,
        profile.photoURL
      );

      // Create cursor broadcaster
      cursorBroadcasterRef.current = createCursorBroadcaster(
        boardId,
        user.uid,
        profile.name
      );

      setBoardReady(true);
    };

    init();

    return () => {
      unsubObjects?.();
      unsubLiveDrags?.();
      leaveBoard?.();
      cursorBroadcasterRef.current?.cleanup();
      cursorBroadcasterRef.current = null;
      liveDragBroadcasterRef.current?.clear();
      liveDragBroadcasterRef.current = null;
    };
  }, [user, profile, boardId]);

  // ── Broadcast cursor position ───────────────────────────────────────
  useEffect(() => {
    if (!boardReady) return;

    // Poll the debug store pointer at ~30fps
    const interval = setInterval(() => {
      const pointer = useDebugStore.getState().pointer;
      // Always broadcast — (0,0) is a valid world position
      cursorBroadcasterRef.current?.broadcast(pointer.worldX, pointer.worldY);
    }, 33);
    return () => clearInterval(interval);
  }, [boardReady]);

  // ── Sync local mutations to Firestore ───────────────────────────────
  useEffect(() => {
    if (!boardReady || !user) return;

    let prevShapes = useCanvasStore.getState().shapes;

    const unsub = useCanvasStore.subscribe((state) => {
      // Skip if this update came FROM Firestore/RTDB
      if (isSyncingRef.current > 0) {
        prevShapes = state.shapes;
        return;
      }

      const curr = state.shapes;
      const prevMap = new Map(prevShapes.map((s) => [s.id, s]));
      const currMap = new Map(curr.map((s) => [s.id, s]));

      // Drain the recently-synced IDs set — these were just applied from
      // Firestore/RTDB and should not be written back.
      const skipIds = recentSyncedIdsRef.current;
      recentSyncedIdsRef.current = new Set();

      // Find added shapes
      const added: Shape[] = [];
      for (const shape of curr) {
        if (!prevMap.has(shape.id) && !skipIds.has(shape.id)) {
          added.push(shape);
        }
      }

      // Find deleted shapes
      const deleted: string[] = [];
      for (const shape of prevShapes) {
        if (!currMap.has(shape.id) && !skipIds.has(shape.id)) {
          deleted.push(shape.id);
        }
      }

      // Find modified shapes
      const modified: Array<{ id: string; patch: Partial<Shape> }> = [];
      for (const shape of curr) {
        const prev = prevMap.get(shape.id);
        if (prev && prev !== shape && !skipIds.has(shape.id)) {
          modified.push({ id: shape.id, patch: shape });
        }
      }

      prevShapes = curr;

      // Write to Firestore (fire-and-forget)
      if (added.length > 0) {
        for (const shape of added) {
          createObject(boardId, shape, user.uid);
        }
      }
      if (deleted.length > 0) {
        deleteObjects(boardId, deleted);
      }
      if (modified.length > 0) {
        updateObjects(boardId, modified, user.uid);
      }
    });

    return unsub;
  }, [boardReady, boardId, user]);

  // ── Expose live drag broadcaster to CanvasStage ─────────────────────
  // CanvasStage will call this during drag to broadcast positions via RTDB
  const handleLiveDrag = useCallback(
    (shapes: Array<{ id: string; x: number; y: number }>) => {
      liveDragBroadcasterRef.current?.broadcast(shapes);
    },
    []
  );

  const handleLiveDragEnd = useCallback(() => {
    liveDragBroadcasterRef.current?.clear();
  }, []);

  // ── Shape creation handlers ─────────────────────────────────────────
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

  // ── Auth guard ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
    }
  }, [authLoading, router, user]);

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
          <Loader2 className="size-4 animate-spin" />
          Preparing your canvas...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Top bar */}
      <div className="sticky top-0 z-40 flex items-center gap-1.5 border-b border-zinc-200 bg-white/80 px-3 py-1.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <h1 className="mr-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          cre8
        </h1>

        <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />

        {/* Tool modes */}
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

        <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />

        {/* Shape creators */}
        <Button size="xs" variant="outline" onClick={handleAddStickyNote} title="Add Sticky Note">
          <StickyNote className="size-3.5" />
          <span className="hidden sm:inline">Sticky</span>
        </Button>
        <Button size="xs" variant="outline" onClick={handleAddRect} title="Add Rectangle">
          <Square className="size-3.5" />
          <span className="hidden sm:inline">Rect</span>
        </Button>
        <Button size="xs" variant="outline" onClick={handleAddCircle} title="Add Circle">
          <Circle className="size-3.5" />
          <span className="hidden sm:inline">Circle</span>
        </Button>
        <Button size="xs" variant="outline" onClick={handleAddText} title="Add Text">
          <Type className="size-3.5" />
          <span className="hidden sm:inline">Text</span>
        </Button>
        <Button size="xs" variant="outline" onClick={handleAddFrame} title="Add Frame">
          <Frame className="size-3.5" />
          <span className="hidden sm:inline">Frame</span>
        </Button>

        <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />

        {/* Undo / Redo */}
        <Button size="icon-xs" variant="ghost" onClick={() => useCanvasStore.getState().undo()} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Undo2 className="size-3.5" />
        </Button>
        <Button size="icon-xs" variant="ghost" onClick={() => useCanvasStore.getState().redo()} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          <Redo2 className="size-3.5" />
        </Button>

        <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />

        {/* Selection actions */}
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => hasSelection && useCanvasStore.getState().duplicateShapes(selectedIds)}
          disabled={!hasSelection}
          title="Duplicate (Ctrl+D)"
        >
          <Copy className="size-3.5" />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => hasSelection && useCanvasStore.getState().deleteShapes(selectedIds)}
          disabled={!hasSelection}
          title="Delete (Backspace)"
        >
          <Trash2 className="size-3.5" />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => hasSelection && useCanvasStore.getState().bringToFront(selectedIds)}
          disabled={!hasSelection}
          title="Bring to Front (Ctrl+])"
        >
          <ArrowUpToLine className="size-3.5" />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => hasSelection && useCanvasStore.getState().sendToBack(selectedIds)}
          disabled={!hasSelection}
          title="Send to Back (Ctrl+[)"
        >
          <ArrowDownToLine className="size-3.5" />
        </Button>

        <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />

        <Button size="xs" variant="ghost" onClick={handleResetView}>
          Reset View
        </Button>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          {/* Presence bar */}
          {boardReady && (
            <PresenceBar boardId={boardId} myUid={user.uid} />
          )}

          <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />

          {/* User info */}
          <div className="hidden items-center gap-2 rounded-md border border-zinc-200 bg-zinc-100 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900 sm:inline-flex">
            {profile?.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.photoURL}
                alt={profile.name}
                className="size-5 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex size-5 items-center justify-center rounded-full bg-zinc-300 text-[10px] font-semibold text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100">
                {(profile?.name ?? user.email ?? "U").slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="max-w-32 truncate text-zinc-700 dark:text-zinc-200">
              {profile?.name ?? user.displayName ?? "Creator"}
            </span>
          </div>

          {hasSelection && (
            <Badge variant="outline" className="tabular-nums">
              {selectedIds.length} selected
            </Badge>
          )}
          <Badge variant="secondary" className="tabular-nums">
            {shapes.length} object{shapes.length !== 1 ? "s" : ""}
          </Badge>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => void signOut()}
            disabled={actionLoading}
            title="Sign out"
          >
            <LogOut className="size-3.5" />
          </Button>
          <ThemeToggle />
        </div>
      </div>

      {/* Canvas area */}
      <div className="relative flex-1">
        <CanvasStage
          boardId={boardId}
          myUid={user.uid}
          onLiveDrag={handleLiveDrag}
          onLiveDragEnd={handleLiveDragEnd}
        />
        <DebugDashboard />
      </div>
    </div>
  );
}
