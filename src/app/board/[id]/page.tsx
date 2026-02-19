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
  createObjects,
  deleteObjects,
  updateObjects,
  getOrCreateBoard,
  updateBoard,
  createLiveDragBroadcaster,
  subscribeLiveDrags,
  type LiveDragData,
  type BoardObjectChange,
} from "@/lib/sync";
import { joinBoard, createCursorBroadcaster } from "@/lib/presence";
import type { Shape } from "@/lib/types";
import { Loader2 } from "lucide-react";
import BoardToolbar from "@/components/board/BoardToolbar";

const CanvasStage = dynamic(() => import("@/components/canvas/CanvasStage"), { ssr: false });
const DebugDashboard = dynamic(() => import("@/components/debug/DebugDashboard"), { ssr: false });
const AICommandInput = dynamic(() => import("@/components/ai/AICommandInput"), { ssr: false });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDeepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (isRecord(a) && isRecord(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if (!(key in b)) return false;
      if (!isDeepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  return false;
}

function areShapesEqual(a: Shape, b: Shape): boolean {
  return isDeepEqual(a, b);
}

function areShapeCollectionsEqual(a: Shape[], b: Shape[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  const byId = new Map(a.map((shape) => [shape.id, shape]));
  if (byId.size !== a.length) return false;

  for (const shape of b) {
    const existing = byId.get(shape.id);
    if (!existing || !areShapesEqual(existing, shape)) return false;
  }

  return true;
}

function areStringArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function getShapePatch(prev: Shape, next: Shape): Partial<Shape> | null {
  const patch: Record<string, unknown> = {};
  let hasChanges = false;

  const prevRecord = prev as unknown as Record<string, unknown>;
  const nextRecord = next as unknown as Record<string, unknown>;

  for (const key of Object.keys(nextRecord)) {
    if (key === "id") continue;
    if (!isDeepEqual(prevRecord[key], nextRecord[key])) {
      patch[key] = nextRecord[key];
      hasChanges = true;
    }
  }

  return hasChanges ? (patch as Partial<Shape>) : null;
}

export default function BoardPage() {
  const router = useRouter();
  const params = useParams();
  const boardId = params.id as string;

  const { user, profile, loading: authLoading, actionLoading, signOut } = useAuth();

  const [boardReady, setBoardReady] = useState(false);
  const [boardName, setBoardName] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const cursorBroadcasterRef = useRef<ReturnType<typeof createCursorBroadcaster> | null>(null);
  const liveDragBroadcasterRef = useRef<ReturnType<typeof createLiveDragBroadcaster> | null>(null);
  const isSyncingRef = useRef(0); // counter: >0 means we're applying remote changes
  // Track which shape IDs we know exist in Firestore (to avoid duplicate creates)
  const remoteShapeIdsRef = useRef<Set<string>>(new Set());
  // IDs recently updated from Firestore — skip writing these back
  const recentSyncedIdsRef = useRef<Set<string>>(new Set());
  // Track live drag overlay from remote users
  const liveDragsRef = useRef<LiveDragData>({});
  const syncGenerationRef = useRef(0);

  // ── Initialize board + sync ────────────────────────────────────────
  useEffect(() => {
    if (!user || !profile || !boardId) return;

    const generation = syncGenerationRef.current + 1;
    syncGenerationRef.current = generation;
    let cancelled = false;

    let unsubObjects: (() => void) | null = null;
    let unsubLiveDrags: (() => void) | null = null;
    let leaveBoard: (() => Promise<void>) | null = null;
    const isStale = () => cancelled || syncGenerationRef.current !== generation;

    const init = async () => {
      // Ensure board document exists
      const boardDoc = await getOrCreateBoard(boardId, {
        uid: user.uid,
        name: profile.name,
        photoURL: profile.photoURL,
      });
      if (isStale()) return;
      setBoardName(boardDoc.name);

      // Subscribe to board objects from Firestore (incremental)
      // All changes in a single snapshot are batched into one store update
      // to avoid cascading re-renders and sync loops.
      const nextUnsubObjects = subscribeBoardObjects(boardId, {
        onInitial: (remoteShapes) => {
          isSyncingRef.current++;
          try {
            remoteShapeIdsRef.current = new Set(remoteShapes.map((s) => s.id));
            for (const s of remoteShapes) recentSyncedIdsRef.current.add(s.id);
            const store = useCanvasStore.getState();
            if (!areShapeCollectionsEqual(store.shapes, remoteShapes)) {
              store.setShapes(remoteShapes);
            }
          } finally {
            isSyncingRef.current--;
          }
        },
        onChanges: (changes: BoardObjectChange[]) => {
          isSyncingRef.current++;
          try {
            const store = useCanvasStore.getState();
            const currentShapes = store.shapes;
            const currentMap = new Map(currentShapes.map((s) => [s.id, s]));
            const indexById = new Map(currentShapes.map((shape, idx) => [shape.id, idx]));

            let newShapes: Array<Shape | null> = [...currentShapes];
            let selectedIds = [...store.selectedIds];
            let didMutateShapes = false;
            let hasRemovals = false;

            for (const change of changes) {
              recentSyncedIdsRef.current.add(change.shape.id);

              switch (change.type) {
                case "added":
                case "modified": {
                  remoteShapeIdsRef.current.add(change.shape.id);
                  const idx = indexById.get(change.shape.id);
                  if (idx == null) {
                    indexById.set(change.shape.id, newShapes.length);
                    currentMap.set(change.shape.id, change.shape);
                    newShapes.push(change.shape);
                    didMutateShapes = true;
                  } else {
                    const existing = currentMap.get(change.shape.id);
                    if (!existing || !areShapesEqual(existing, change.shape)) {
                      newShapes[idx] = change.shape;
                      currentMap.set(change.shape.id, change.shape);
                      didMutateShapes = true;
                    }
                  }
                  break;
                }
                case "removed": {
                  remoteShapeIdsRef.current.delete(change.shape.id);
                  const idx = indexById.get(change.shape.id);
                  if (idx != null) {
                    newShapes[idx] = null;
                    indexById.delete(change.shape.id);
                    currentMap.delete(change.shape.id);
                    selectedIds = selectedIds.filter((id) => id !== change.shape.id);
                    didMutateShapes = true;
                    hasRemovals = true;
                  }
                  break;
                }
              }
            }

            const nextShapes = hasRemovals
              ? newShapes.filter((shape): shape is Shape => shape !== null)
              : (newShapes as Shape[]);

            if (didMutateShapes && !areShapeCollectionsEqual(currentShapes, nextShapes)) {
              store.setShapes(nextShapes);
            }
            if (!areStringArraysEqual(selectedIds, store.selectedIds)) {
              store.setSelected(selectedIds);
            }
          } finally {
            isSyncingRef.current--;
          }
        },
      });
      if (isStale()) {
        nextUnsubObjects();
        return;
      }
      unsubObjects = nextUnsubObjects;

      // Subscribe to live drag positions from remote users
      const nextUnsubLiveDrags = subscribeLiveDrags(boardId, user.uid, (drags) => {
        liveDragsRef.current = drags;
        // Apply remote drag positions directly to local shapes
        isSyncingRef.current++;
        try {
          const store = useCanvasStore.getState();
          const shapeById = new Map(store.shapes.map((shape) => [shape.id, shape]));
          const updates: Array<{ id: string; patch: Partial<Shape> }> = [];
          for (const [id, data] of Object.entries(drags)) {
            const existing = shapeById.get(id);
            if (!existing) continue;
            if (existing.x === data.x && existing.y === data.y) continue;
            updates.push({ id, patch: { x: data.x, y: data.y } });
            recentSyncedIdsRef.current.add(id);
          }
          if (updates.length > 0) {
            store.updateShapes(updates);
          }
        } finally {
          isSyncingRef.current--;
        }
      });
      if (isStale()) {
        nextUnsubLiveDrags();
        return;
      }
      unsubLiveDrags = nextUnsubLiveDrags;

      // Create live drag broadcaster
      liveDragBroadcasterRef.current = createLiveDragBroadcaster(boardId, user.uid);
      if (isStale()) {
        liveDragBroadcasterRef.current.clear();
        liveDragBroadcasterRef.current = null;
        return;
      }

      // Join presence
      leaveBoard = joinBoard(boardId, user.uid, profile.name, profile.photoURL);
      if (isStale()) {
        leaveBoard().catch(() => {});
        leaveBoard = null;
        return;
      }

      // Create cursor broadcaster
      cursorBroadcasterRef.current = createCursorBroadcaster(boardId, user.uid, profile.name);
      if (isStale()) {
        cursorBroadcasterRef.current.cleanup().catch(() => {});
        cursorBroadcasterRef.current = null;
        return;
      }

      setBoardReady(true);
    };

    init().catch((error) => {
      if (!isStale()) {
        console.error("Board init failed:", error);
      }
    });

    const teardown = async () => {
      setBoardReady(false);
      unsubObjects?.();
      unsubObjects = null;
      unsubLiveDrags?.();
      unsubLiveDrags = null;
      // Await RTDB writes so they complete before auth is revoked
      await Promise.all([leaveBoard?.(), cursorBroadcasterRef.current?.cleanup()]);
      leaveBoard = null;
      cursorBroadcasterRef.current = null;
      liveDragBroadcasterRef.current?.clear();
      liveDragBroadcasterRef.current = null;
      // Guard shape clear so the local-to-Firestore sync effect ignores it
      // (otherwise it would interpret the clear as "user deleted all shapes")
      isSyncingRef.current++;
      try {
        useCanvasStore.getState().setShapes([]);
        useCanvasStore.getState().setSelected([]);
      } finally {
        isSyncingRef.current--;
      }
    };

    // Clean up BEFORE sign-out so RTDB writes happen while still authenticated
    const onBeforeSignOut = () => {
      void teardown();
    };
    window.addEventListener("before-sign-out", onBeforeSignOut);
    // Also clean up on tab close / navigation away
    window.addEventListener("beforeunload", onBeforeSignOut);

    return () => {
      cancelled = true;
      window.removeEventListener("before-sign-out", onBeforeSignOut);
      window.removeEventListener("beforeunload", onBeforeSignOut);
      void teardown();
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
        if (prev && !skipIds.has(shape.id)) {
          const patch = getShapePatch(prev, shape);
          if (patch) {
            modified.push({ id: shape.id, patch });
          }
        }
      }

      prevShapes = curr;

      // Write to Firestore (fire-and-forget, batched)
      if (added.length > 0) {
        if (added.length === 1) {
          createObject(boardId, added[0], user.uid);
        } else {
          createObjects(boardId, added, user.uid);
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
  const handleLiveDrag = useCallback((shapes: Array<{ id: string; x: number; y: number }>) => {
    liveDragBroadcasterRef.current?.broadcast(shapes);
  }, []);

  const handleLiveDragEnd = useCallback(() => {
    liveDragBroadcasterRef.current?.clear();
  }, []);

  // ── Auth guard ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
    }
  }, [authLoading, router, user]);

  // Expose stores for Playwright perf tests (dev only)
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__cre8 = { canvas: useCanvasStore, debug: useDebugStore };
  }

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="inline-flex items-center gap-2.5 rounded-lg border border-zinc-200 bg-white px-5 py-3 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <Loader2 className="size-4 animate-spin" />
          Loading canvas...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#ededed] dark:bg-[#1a1a1e]">
      <BoardToolbar
        boardId={boardId}
        boardName={boardName}
        onBoardNameChange={async (newName: string) => {
          await updateBoard(boardId, { name: newName });
          setBoardName(newName);
        }}
        user={user}
        profile={profile!}
        boardReady={boardReady}
        showDebug={showDebug}
        setShowDebug={setShowDebug}
        actionLoading={actionLoading}
        signOut={signOut}
      />

      {/* ── Canvas area ── */}
      <div className="relative flex-1">
        <CanvasStage
          boardId={boardId}
          myUid={user.uid}
          onLiveDrag={handleLiveDrag}
          onLiveDragEnd={handleLiveDragEnd}
        />
        {showDebug && <DebugDashboard />}
        {user && <AICommandInput boardId={boardId} />}
      </div>
    </div>
  );
}
