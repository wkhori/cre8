"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useCanvasStore } from "@/store/canvas-store";
import { useDebugStore } from "@/store/debug-store";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  subscribeBoardObjects,
  createObjects,
  deleteObjects,
  updateObjects,
  getOrCreateBoard,
  updateBoard,
  createLiveDragBroadcaster,
  subscribeLiveDrags,
  type BoardObjectChange,
} from "@/lib/sync";
import { joinBoard, createCursorBroadcaster } from "@/lib/presence";
import type { Shape } from "@/lib/types";
import { isRenderOnly } from "@/lib/sync-mode";
import { diffShapeWrites } from "@/lib/board-sync-diff";
import { Loader2 } from "lucide-react";
import BoardToolbar from "@/components/board/BoardToolbar";

const CanvasStage = dynamic(() => import("@/components/canvas/CanvasStage"), { ssr: false });
const DebugDashboard = dynamic(() => import("@/components/debug/DebugDashboard"), { ssr: false });
const AICommandInput = dynamic(() => import("@/components/ai/AICommandInput"), { ssr: false });
const LIVE_DRAG_HOLD_MS = 180;
const SYNC_DEBUG_STORAGE_KEY = "cre8:sync-debug";
const SYNC_DEBUG_QUERY_KEY = "syncDebug";

function takeSampleIds(ids: Iterable<string>, max = 6): string[] {
  const sample: string[] = [];
  for (const id of ids) {
    sample.push(id);
    if (sample.length >= max) break;
  }
  return sample;
}

function shapeShallowEqual(a: Shape, b: Shape): boolean {
  const aKeys = Object.keys(a) as (keyof Shape)[];
  const bKeys = Object.keys(b) as (keyof Shape)[];
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

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
  const remoteDragBufferRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const remoteDragRafRef = useRef<number>(0);
  const liveDraggingUntilRef = useRef<Map<string, number>>(new Map());
  const liveDragSweepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deferredLiveDragChangesRef = useRef<Map<string, Shape | null>>(new Map());
  const syncDebugEnabledRef = useRef(false);
  const lastLiveDragLogAtRef = useRef(0);
  const lastFirestoreLogAtRef = useRef(0);
  const lastWriteLogAtRef = useRef(0);

  // Sync guard: >0 means we're applying remote changes.
  // The zustand subscriber checks this synchronously and skips outbound writes.
  // This is the ONLY mechanism needed to prevent Firestore→store→Firestore loops.
  const isSyncingRef = useRef(0);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const searchParams = new URLSearchParams(window.location.search);
    const queryValue = searchParams.get(SYNC_DEBUG_QUERY_KEY);
    if (queryValue === "1") {
      window.localStorage.setItem(SYNC_DEBUG_STORAGE_KEY, "1");
    } else if (queryValue === "0") {
      window.localStorage.removeItem(SYNC_DEBUG_STORAGE_KEY);
    }
    const enabled = window.localStorage.getItem(SYNC_DEBUG_STORAGE_KEY) === "1";
    syncDebugEnabledRef.current = enabled;
    if (enabled) {
      console.info(
        `[sync-debug][${boardId}] receiver diagnostics enabled. Disable with localStorage.removeItem("${SYNC_DEBUG_STORAGE_KEY}") and reload.`
      );
    }
  }, [boardId]);

  const syncDebugLog = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      if (!syncDebugEnabledRef.current) return;
      console.log(`[sync-debug][${boardId}] ${event}`, payload);
    },
    [boardId]
  );

  const sampledSyncDebugLog = useCallback(
    (
      event: string,
      payload: Record<string, unknown>,
      gateRef: { current: number },
      minGapMs: number
    ) => {
      if (!syncDebugEnabledRef.current) return;
      const now = performance.now();
      if (now - gateRef.current < minGapMs) return;
      gateRef.current = now;
      syncDebugLog(event, payload);
    },
    [syncDebugLog]
  );

  // ── Initialize board + sync ────────────────────────────────────────

  const sweepLiveDragging = useCallback((now = Date.now()) => {
    const liveDragging = liveDraggingUntilRef.current;
    for (const [id, until] of liveDragging) {
      if (until <= now) liveDragging.delete(id);
    }
    return liveDragging.size;
  }, []);

  const flushDeferredLiveDragChanges = useCallback(() => {
    const deferred = deferredLiveDragChangesRef.current;
    if (deferred.size === 0) return;
    syncDebugLog("deferred-flush:start", {
      deferredCount: deferred.size,
      deferredIds: takeSampleIds(deferred.keys()),
      liveDraggingCount: liveDraggingUntilRef.current.size,
    });

    isSyncingRef.current++;
    try {
      const store = useCanvasStore.getState();
      const currentShapes = store.shapes;
      const currentIds = new Set(currentShapes.map((shape) => shape.id));

      const removedIds = new Set<string>();
      const modifiedMap = new Map<string, Shape>();
      const added: Shape[] = [];

      for (const [id, shape] of deferred) {
        if (shape === null) {
          removedIds.add(id);
          continue;
        }

        if (currentIds.has(id)) modifiedMap.set(id, shape);
        else added.push(shape);
      }

      let nextShapes = currentShapes;
      if (removedIds.size > 0 || modifiedMap.size > 0) {
        nextShapes = currentShapes
          .filter((shape) => !removedIds.has(shape.id))
          .map((shape) => modifiedMap.get(shape.id) ?? shape);
      }
      if (added.length > 0) {
        nextShapes = [...nextShapes, ...added];
      }

      if (nextShapes !== currentShapes) {
        store.setShapes(nextShapes);
      }

      if (removedIds.size > 0) {
        const selectedIds = store.selectedIds.filter((id) => !removedIds.has(id));
        if (selectedIds.length !== store.selectedIds.length) {
          store.setSelected(selectedIds);
        }
      }
      syncDebugLog("deferred-flush:applied", {
        removed: removedIds.size,
        modified: modifiedMap.size,
        added: added.length,
      });
    } finally {
      isSyncingRef.current--;
      deferred.clear();
    }
  }, [syncDebugLog]);

  const scheduleDeferredFlush = useCallback(() => {
    if (liveDragSweepTimerRef.current) {
      clearTimeout(liveDragSweepTimerRef.current);
    }
    liveDragSweepTimerRef.current = setTimeout(() => {
      liveDragSweepTimerRef.current = null;
      if (sweepLiveDragging() === 0) {
        flushDeferredLiveDragChanges();
      }
    }, LIVE_DRAG_HOLD_MS + 20);
  }, [sweepLiveDragging, flushDeferredLiveDragChanges]);

  useEffect(() => {
    if (!user || !profile || !boardId) return;
    if (renderOnly) return;

    let unsubObjects: (() => void) | null = null;
    let unsubLiveDrags: (() => void) | null = null;
    let leaveBoard: (() => Promise<void>) | null = null;

    const init = async () => {
      const boardDoc = await getOrCreateBoard(boardId, {
        uid: user.uid,
        name: profile.name,
        photoURL: profile.photoURL,
      });
      setBoardName(boardDoc.name);

      // Firestore object sync
      unsubObjects = subscribeBoardObjects(boardId, {
        onInitial: (remoteShapes) => {
          isSyncingRef.current++;
          useCanvasStore.getState().setShapes(remoteShapes);
          isSyncingRef.current--;
        },

        onChanges: (changes: BoardObjectChange[]) => {
          isSyncingRef.current++;
          try {
            const store = useCanvasStore.getState();
            const currentShapes = store.shapes;
            const currentIds = new Set(currentShapes.map((s) => s.id));
            const currentById = new Map(currentShapes.map((s) => [s.id, s]));
            sweepLiveDragging();

            const modifiedMap = new Map<string, Shape>();
            const removedIds = new Set<string>();
            const added: Shape[] = [];
            let deferredCount = 0;
            let bufferedPosConflictCount = 0;
            const bufferedPosConflictIds: string[] = [];
            let addedCount = 0;
            let modifiedCount = 0;
            let removedCount = 0;

            for (const change of changes) {
              const id = change.shape.id;
              if (change.type === "added") addedCount++;
              if (change.type === "modified") modifiedCount++;
              if (change.type === "removed") removedCount++;

              const bufferedPos = remoteDragBufferRef.current.get(id);
              if (
                bufferedPos &&
                change.type !== "removed" &&
                (change.shape.x !== bufferedPos.x || change.shape.y !== bufferedPos.y)
              ) {
                bufferedPosConflictCount++;
                if (bufferedPosConflictIds.length < 6) bufferedPosConflictIds.push(id);
              }

              if (liveDraggingUntilRef.current.has(id)) {
                deferredLiveDragChangesRef.current.set(
                  id,
                  change.type === "removed" ? null : change.shape
                );
                deferredCount++;
                continue;
              }

              switch (change.type) {
                case "added":
                  if (currentIds.has(id)) {
                    const existing = currentById.get(id);
                    if (existing && !shapeShallowEqual(existing, change.shape)) {
                      modifiedMap.set(id, change.shape);
                    }
                  } else {
                    added.push(change.shape);
                  }
                  break;
                case "modified":
                  {
                    const existing = currentById.get(id);
                    if (!existing || !shapeShallowEqual(existing, change.shape)) {
                      modifiedMap.set(id, change.shape);
                    }
                  }
                  break;
                case "removed":
                  removedIds.add(id);
                  break;
              }
            }

            let newShapes = currentShapes;
            if (removedIds.size > 0 || modifiedMap.size > 0) {
              newShapes = currentShapes
                .filter((s) => !removedIds.has(s.id))
                .map((s) => modifiedMap.get(s.id) ?? s);
            }
            if (added.length > 0) {
              newShapes = [...newShapes, ...added];
            }

            if (newShapes !== currentShapes) {
              store.setShapes(newShapes);
            }

            if (removedIds.size > 0) {
              const selectedIds = store.selectedIds.filter((id) => !removedIds.has(id));
              if (selectedIds.length !== store.selectedIds.length) {
                store.setSelected(selectedIds);
              }
            }

            sampledSyncDebugLog(
              "firestore-onChanges",
              {
                incoming: {
                  total: changes.length,
                  added: addedCount,
                  modified: modifiedCount,
                  removed: removedCount,
                },
                applied: {
                  added: added.length,
                  modified: modifiedMap.size,
                  removed: removedIds.size,
                },
                deferredCount,
                deferredIds: takeSampleIds(deferredLiveDragChangesRef.current.keys()),
                liveDraggingCount: liveDraggingUntilRef.current.size,
                bufferedPosConflictCount,
                bufferedPosConflictIds,
              },
              lastFirestoreLogAtRef,
              120
            );
          } finally {
            isSyncingRef.current--;
          }
        },
      });

      // Live drag from remote users
      unsubLiveDrags = subscribeLiveDrags(boardId, user.uid, (drags) => {
        const now = Date.now();
        sweepLiveDragging(now);
        const dragEntries = Object.entries(drags);
        const buffer = remoteDragBufferRef.current;
        buffer.clear();
        if (dragEntries.length === 0) {
          sampledSyncDebugLog(
            "live-drag:update-empty",
            {
              liveDraggingCount: liveDraggingUntilRef.current.size,
              deferredCount: deferredLiveDragChangesRef.current.size,
            },
            lastLiveDragLogAtRef,
            200
          );
          scheduleDeferredFlush();
          return;
        }

        const liveDragging = liveDraggingUntilRef.current;
        let minTs = Number.POSITIVE_INFINITY;
        let maxTs = Number.NEGATIVE_INFINITY;
        const sample: Array<{ id: string; x: number; y: number; ts: number; uid: string }> = [];
        for (const [id, data] of dragEntries) {
          liveDragging.set(id, now + LIVE_DRAG_HOLD_MS);
          buffer.set(id, { x: data.x, y: data.y });
          if (data.ts < minTs) minTs = data.ts;
          if (data.ts > maxTs) maxTs = data.ts;
          if (sample.length < 4) {
            sample.push({ id, x: data.x, y: data.y, ts: data.ts, uid: data.uid });
          }
        }
        sampledSyncDebugLog(
          "live-drag:update",
          {
            entries: dragEntries.length,
            minTs,
            maxTs,
            liveDraggingCount: liveDragging.size,
            sample,
          },
          lastLiveDragLogAtRef,
          80
        );
        scheduleDeferredFlush();

        if (remoteDragRafRef.current) return;
        remoteDragRafRef.current = requestAnimationFrame(() => {
          remoteDragRafRef.current = 0;
          isSyncingRef.current++;
          try {
            const store = useCanvasStore.getState();
            const shapeById = new Map(store.shapes.map((shape) => [shape.id, shape]));
            const updates: Array<{ id: string; patch: Partial<Shape> }> = [];
            const updateSample: Array<{
              id: string;
              fromX: number;
              fromY: number;
              toX: number;
              toY: number;
            }> = [];
            for (const [id, pos] of remoteDragBufferRef.current) {
              const shape = shapeById.get(id);
              if (shape && (shape.x !== pos.x || shape.y !== pos.y)) {
                updates.push({ id, patch: { x: pos.x, y: pos.y } });
                if (updateSample.length < 4) {
                  updateSample.push({
                    id,
                    fromX: shape.x,
                    fromY: shape.y,
                    toX: pos.x,
                    toY: pos.y,
                  });
                }
              }
            }
            if (updates.length > 0) store.updateShapes(updates);
            sampledSyncDebugLog(
              "live-drag:raf-apply",
              {
                updates: updates.length,
                updateSample,
              },
              lastLiveDragLogAtRef,
              80
            );
          } finally {
            isSyncingRef.current--;
          }
        });
      });

      liveDragBroadcasterRef.current = createLiveDragBroadcaster(boardId, user.uid);
      leaveBoard = joinBoard(boardId, user.uid, profile.name, profile.photoURL);
      cursorBroadcasterRef.current = createCursorBroadcaster(boardId, user.uid, profile.name);
      setBoardReady(true);
    };

    init();

    const teardown = async () => {
      setBoardReady(false);
      unsubObjects?.();
      unsubLiveDrags?.();
      await Promise.all([leaveBoard?.(), cursorBroadcasterRef.current?.cleanup()]);
      cursorBroadcasterRef.current = null;
      liveDragBroadcasterRef.current?.clear();
      liveDragBroadcasterRef.current = null;
      remoteDragBufferRef.current.clear();
      if (remoteDragRafRef.current) {
        cancelAnimationFrame(remoteDragRafRef.current);
        remoteDragRafRef.current = 0;
      }
      if (liveDragSweepTimerRef.current) {
        clearTimeout(liveDragSweepTimerRef.current);
        liveDragSweepTimerRef.current = null;
      }
      liveDraggingUntilRef.current.clear();
      deferredLiveDragChangesRef.current.clear();
      writeQueueRef.current = Promise.resolve();
      isSyncingRef.current++;
      useCanvasStore.getState().setShapes([]);
      useCanvasStore.getState().setSelected([]);
      isSyncingRef.current--;
    };

    const onBeforeSignOut = () => {
      teardown();
    };
    window.addEventListener("before-sign-out", onBeforeSignOut);
    window.addEventListener("beforeunload", onBeforeSignOut);

    return () => {
      window.removeEventListener("before-sign-out", onBeforeSignOut);
      window.removeEventListener("beforeunload", onBeforeSignOut);
      teardown();
    };
  }, [
    user,
    profile,
    boardId,
    renderOnly,
    flushDeferredLiveDragChanges,
    scheduleDeferredFlush,
    sweepLiveDragging,
    sampledSyncDebugLog,
  ]);

  // ── Broadcast cursor position ───────────────────────────────────────

  useEffect(() => {
    if (!boardReady) return;
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
    let cancelled = false;

    const queueWrite = (ids: string[], op: () => Promise<void>) => {
      if (ids.length === 0) return;

      writeQueueRef.current = writeQueueRef.current
        .then(async () => {
          if (cancelled) return;
          let lastError: unknown = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              await op();
              return;
            } catch (error) {
              lastError = error;
              if (attempt < 2) {
                await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 150));
              }
            }
          }
          throw lastError;
        })
        .catch((error) => {
          console.error("Board sync write failed:", error);
        });
    };

    const unsub = useCanvasStore.subscribe((state) => {
      // isSyncingRef is checked synchronously — zustand subscribers fire
      // inside set(), so this runs BEFORE isSyncingRef is decremented.
      if (isSyncingRef.current > 0) {
        prevShapes = state.shapes;
        return;
      }

      const curr = state.shapes;
      if (curr === prevShapes) return;
      const { added, deleted, modified } = diffShapeWrites(prevShapes, curr);

      prevShapes = curr;

      if (added.length === 0 && deleted.length === 0 && modified.length === 0) {
        return;
      }

      sampledSyncDebugLog(
        "outbound-write:queue",
        {
          added: added.length,
          deleted: deleted.length,
          modified: modified.length,
          ids: takeSampleIds(
            [
              ...added.map((shape) => shape.id),
              ...deleted,
              ...modified.map((update) => update.id),
            ].values()
          ),
        },
        lastWriteLogAtRef,
        120
      );

      const idsToTrack = [
        ...added.map((shape) => shape.id),
        ...deleted,
        ...modified.map((update) => update.id),
      ];

      queueWrite(idsToTrack, async () => {
        if (added.length > 0) await createObjects(boardId, added, user.uid);
        if (deleted.length > 0) await deleteObjects(boardId, deleted);
        if (modified.length > 0) await updateObjects(boardId, modified, user.uid);
      });
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [boardReady, boardId, user, renderOnly, sampledSyncDebugLog]);

  const handleLiveDrag = useCallback((shapes: Array<{ id: string; x: number; y: number }>) => {
    liveDragBroadcasterRef.current?.broadcast(shapes);
  }, []);

  const handleLiveDragEnd = useCallback(() => {
    liveDragBroadcasterRef.current?.clear();
  }, []);

  // ── Auth guard ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
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
