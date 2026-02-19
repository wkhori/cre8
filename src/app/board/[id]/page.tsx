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
  updateBoard,
  createLiveDragBroadcaster,
  subscribeLiveDrags,
  type LiveDragData,
  type BoardObjectChange,
} from "@/lib/sync";
import { joinBoard, createCursorBroadcaster } from "@/lib/presence";
import type { Shape } from "@/lib/types";
import { isRenderOnly } from "@/lib/sync-mode";
import { Loader2 } from "lucide-react";
import BoardToolbar from "@/components/board/BoardToolbar";

const CanvasStage = dynamic(() => import("@/components/canvas/CanvasStage"), { ssr: false });
const DebugDashboard = dynamic(() => import("@/components/debug/DebugDashboard"), { ssr: false });
const AICommandInput = dynamic(() => import("@/components/ai/AICommandInput"), { ssr: false });

export default function BoardPage() {
  const router = useRouter();
  const params = useParams();
  const boardId = params.id as string;

  const { user, profile, loading: authLoading, actionLoading, signOut } = useAuth();

  const renderOnly = isRenderOnly();
  const [boardReady, setBoardReady] = useState(renderOnly);
  const [boardName, setBoardName] = useState(renderOnly ? "Local Board (render-only)" : "");
  const [showDebug, setShowDebug] = useState(false);
  const cursorBroadcasterRef = useRef<ReturnType<typeof createCursorBroadcaster> | null>(null);
  const liveDragBroadcasterRef = useRef<ReturnType<typeof createLiveDragBroadcaster> | null>(null);
  const isSyncingRef = useRef(0); // counter: >0 means we're applying remote changes
  // Track which shape IDs we know exist in Firestore (to avoid duplicate creates)
  const remoteShapeIdsRef = useRef<Set<string>>(new Set());
  // IDs recently updated from Firestore — skip writing these back
  const recentSyncedIdsRef = useRef<Set<string>>(new Set());
  // Track live drag overlay from remote users (ref only — NOT in store)
  const liveDragsRef = useRef<LiveDragData>({});
  // Counter to trigger CanvasStage re-render when remote drag positions change
  const [remoteDragEpoch, setRemoteDragEpoch] = useState(0);

  // ── Initialize board + sync ────────────────────────────────────────

  useEffect(() => {
    if (!user || !profile || !boardId) return;

    // In render-only mode, skip all Firebase operations
    if (renderOnly) return;

    let unsubObjects: (() => void) | null = null;
    let unsubLiveDrags: (() => void) | null = null;
    let leaveBoard: (() => Promise<void>) | null = null;

    const init = async () => {
      // Ensure board document exists
      const boardDoc = await getOrCreateBoard(boardId, {
        uid: user.uid,
        name: profile.name,
        photoURL: profile.photoURL,
      });
      setBoardName(boardDoc.name);

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
          const currentIds = new Set(currentShapes.map((s) => s.id));

          // Collect all changes into maps for single-pass merge
          // (avoids O(N²) from per-change .map() over entire array)
          const modifiedMap = new Map<string, Shape>();
          const removedIds = new Set<string>();
          const added: Shape[] = [];

          for (const change of changes) {
            recentSyncedIdsRef.current.add(change.shape.id);

            switch (change.type) {
              case "added":
                remoteShapeIdsRef.current.add(change.shape.id);
                if (currentIds.has(change.shape.id)) {
                  modifiedMap.set(change.shape.id, change.shape);
                } else {
                  added.push(change.shape);
                }
                break;
              case "modified":
                modifiedMap.set(change.shape.id, change.shape);
                break;
              case "removed":
                remoteShapeIdsRef.current.delete(change.shape.id);
                removedIds.add(change.shape.id);
                break;
            }
          }

          // Single-pass merge: filter removed, apply modified, append added
          let newShapes = currentShapes;
          if (removedIds.size > 0 || modifiedMap.size > 0) {
            newShapes = currentShapes
              .filter((s) => !removedIds.has(s.id))
              .map((s) => {
                const mod = modifiedMap.get(s.id);
                return mod ? { ...s, ...mod } : s;
              });
          }
          if (added.length > 0) {
            newShapes = [...newShapes, ...added];
          }

          store.setShapes(newShapes);

          // Remove deleted shapes from selection
          if (removedIds.size > 0) {
            const selectedIds = store.selectedIds.filter((id) => !removedIds.has(id));
            if (selectedIds.length !== store.selectedIds.length) {
              store.setSelected(selectedIds);
            }
          }
          isSyncingRef.current--;
        },
      });

      // Subscribe to live drag positions from remote users.
      // Positions stay in liveDragsRef (NOT written to store) to avoid
      // the local→Firestore subscriber writing them back as local changes.
      // CanvasStage reads this ref directly for rendering.
      unsubLiveDrags = subscribeLiveDrags(boardId, user.uid, (drags) => {
        liveDragsRef.current = drags;
        // Trigger CanvasStage re-render to pick up new positions
        setRemoteDragEpoch((e) => e + 1);
      });

      // Create live drag broadcaster
      liveDragBroadcasterRef.current = createLiveDragBroadcaster(boardId, user.uid);

      // Join presence
      leaveBoard = joinBoard(boardId, user.uid, profile.name, profile.photoURL);

      // Create cursor broadcaster
      cursorBroadcasterRef.current = createCursorBroadcaster(boardId, user.uid, profile.name);

      setBoardReady(true);
    };

    init();

    const teardown = async () => {
      setBoardReady(false);
      unsubObjects?.();
      unsubLiveDrags?.();
      // Await RTDB writes so they complete before auth is revoked
      await Promise.all([leaveBoard?.(), cursorBroadcasterRef.current?.cleanup()]);
      cursorBroadcasterRef.current = null;
      liveDragBroadcasterRef.current?.clear();
      liveDragBroadcasterRef.current = null;
      // Guard shape clear so the local-to-Firestore sync effect ignores it
      // (otherwise it would interpret the clear as "user deleted all shapes")
      isSyncingRef.current++;
      useCanvasStore.getState().setShapes([]);
      useCanvasStore.getState().setSelected([]);
      isSyncingRef.current--;
    };

    // Clean up BEFORE sign-out so RTDB writes happen while still authenticated
    const onBeforeSignOut = () => {
      teardown();
    };
    window.addEventListener("before-sign-out", onBeforeSignOut);
    // Also clean up on tab close / navigation away
    window.addEventListener("beforeunload", onBeforeSignOut);

    return () => {
      window.removeEventListener("before-sign-out", onBeforeSignOut);
      window.removeEventListener("beforeunload", onBeforeSignOut);
      teardown();
    };
  }, [user, profile, boardId, renderOnly]);

  // ── Broadcast cursor position ───────────────────────────────────────
  useEffect(() => {
    if (!boardReady) return;

    // Poll the debug store pointer at ~30fps
    // Skip if position unchanged — avoids ~30 RTDB writes/sec when idle
    let lastX = NaN;
    let lastY = NaN;
    const interval = setInterval(() => {
      const pointer = useDebugStore.getState().pointer;
      if (pointer.worldX === lastX && pointer.worldY === lastY) return;
      lastX = pointer.worldX;
      lastY = pointer.worldY;
      cursorBroadcasterRef.current?.broadcast(pointer.worldX, pointer.worldY);
    }, 33);
    return () => clearInterval(interval);
  }, [boardReady]);

  // ── Sync local mutations to Firestore ───────────────────────────────
  useEffect(() => {
    if (!boardReady || !user || renderOnly) return;

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

      // Find modified shapes — only send fields that actually changed
      const modified: Array<{ id: string; patch: Partial<Shape> }> = [];
      for (const shape of curr) {
        const prev = prevMap.get(shape.id);
        if (prev && prev !== shape && !skipIds.has(shape.id)) {
          const patch: Record<string, unknown> = {};
          for (const key of Object.keys(shape) as (keyof Shape)[]) {
            if (shape[key] !== prev[key]) {
              patch[key] = shape[key];
            }
          }
          // Only push if there are real changes (not just reference inequality)
          if (Object.keys(patch).length > 0) {
            modified.push({ id: shape.id, patch: patch as Partial<Shape> });
          }
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
  }, [boardReady, boardId, user, renderOnly]);

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
          remoteDragsRef={liveDragsRef}
          remoteDragEpoch={remoteDragEpoch}
        />
        {showDebug && <DebugDashboard />}
        {user && <AICommandInput boardId={boardId} />}
      </div>
    </div>
  );
}
