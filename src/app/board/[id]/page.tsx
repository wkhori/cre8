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

  // Sync guard: >0 means we're applying remote changes.
  // The zustand subscriber checks this synchronously and skips outbound writes.
  // This is the ONLY mechanism needed to prevent Firestore→store→Firestore loops.
  const isSyncingRef = useRef(0);

  // Shape IDs currently being dragged/transformed by the local user.
  // Inbound remote changes for these shapes are deferred until interaction ends.
  const lockedIdsRef = useRef<Set<string>>(new Set());
  const deferredChangesRef = useRef<Map<string, Shape | null>>(new Map());

  const lockShapes = useCallback((ids: string[]) => {
    for (const id of ids) lockedIdsRef.current.add(id);
  }, []);

  const unlockShapes = useCallback(() => {
    const deferred = deferredChangesRef.current;
    if (deferred.size > 0) {
      isSyncingRef.current++;
      try {
        const store = useCanvasStore.getState();
        let shapes = store.shapes;
        const toRemove = new Set<string>();
        const toModify = new Map<string, Shape>();

        for (const [id, shape] of deferred) {
          if (shape === null) toRemove.add(id);
          else toModify.set(id, shape);
        }

        if (toRemove.size > 0 || toModify.size > 0) {
          const existingIds = new Set(shapes.map((s) => s.id));
          shapes = shapes.filter((s) => !toRemove.has(s.id)).map((s) => toModify.get(s.id) ?? s);
          for (const [id, shape] of toModify) {
            if (shape && !existingIds.has(id)) shapes.push(shape);
          }
          store.setShapes(shapes);
        }

        if (toRemove.size > 0) {
          const selectedIds = store.selectedIds.filter((id) => !toRemove.has(id));
          if (selectedIds.length !== store.selectedIds.length) {
            store.setSelected(selectedIds);
          }
        }
      } finally {
        isSyncingRef.current--;
      }
      deferred.clear();
    }
    lockedIdsRef.current.clear();
  }, []);

  // ── Initialize board + sync ────────────────────────────────────────

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
            const locked = lockedIdsRef.current;

            const modifiedMap = new Map<string, Shape>();
            const removedIds = new Set<string>();
            const added: Shape[] = [];

            for (const change of changes) {
              const id = change.shape.id;

              // Defer changes for shapes being dragged/transformed locally
              if (locked.has(id)) {
                deferredChangesRef.current.set(id, change.type === "removed" ? null : change.shape);
                continue;
              }

              switch (change.type) {
                case "added":
                  if (currentIds.has(id)) modifiedMap.set(id, change.shape);
                  else added.push(change.shape);
                  break;
                case "modified":
                  modifiedMap.set(id, change.shape);
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
          } finally {
            isSyncingRef.current--;
          }
        },
      });

      // Live drag from remote users
      unsubLiveDrags = subscribeLiveDrags(boardId, user.uid, (drags) => {
        const dragEntries = Object.entries(drags);
        if (dragEntries.length === 0) return;

        isSyncingRef.current++;
        try {
          const store = useCanvasStore.getState();
          const locked = lockedIdsRef.current;
          const updates: Array<{ id: string; patch: Partial<Shape> }> = [];
          for (const [id, data] of dragEntries) {
            if (!locked.has(id)) {
              updates.push({ id, patch: { x: data.x, y: data.y } });
            }
          }
          if (updates.length > 0) store.updateShapes(updates);
        } finally {
          isSyncingRef.current--;
        }
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
  }, [user, profile, boardId, renderOnly, unlockShapes]);

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

    const unsub = useCanvasStore.subscribe((state) => {
      // isSyncingRef is checked synchronously — zustand subscribers fire
      // inside set(), so this runs BEFORE isSyncingRef is decremented.
      if (isSyncingRef.current > 0) {
        prevShapes = state.shapes;
        return;
      }

      const curr = state.shapes;
      if (curr === prevShapes) return;

      const prevMap = new Map(prevShapes.map((s) => [s.id, s]));
      const currMap = new Map(curr.map((s) => [s.id, s]));

      const added: Shape[] = [];
      for (const shape of curr) {
        if (!prevMap.has(shape.id)) added.push(shape);
      }

      const deleted: string[] = [];
      for (const shape of prevShapes) {
        if (!currMap.has(shape.id)) deleted.push(shape.id);
      }

      const modified: Array<{ id: string; patch: Partial<Shape> }> = [];
      for (const shape of curr) {
        const prev = prevMap.get(shape.id);
        if (prev && prev !== shape) {
          const patch: Record<string, unknown> = {};
          for (const key of Object.keys(shape) as (keyof Shape)[]) {
            if (shape[key] !== prev[key]) {
              patch[key] = shape[key];
            }
          }
          if (Object.keys(patch).length > 0) {
            modified.push({ id: shape.id, patch: patch as Partial<Shape> });
          }
        }
      }

      prevShapes = curr;

      if (added.length > 0) createObjects(boardId, added, user.uid);
      if (deleted.length > 0) deleteObjects(boardId, deleted);
      if (modified.length > 0) updateObjects(boardId, modified, user.uid);
    });

    return unsub;
  }, [boardReady, boardId, user, renderOnly]);

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
          onLockShapes={lockShapes}
          onUnlockShapes={unlockShapes}
        />
        {showDebug && <DebugDashboard />}
        {user && <AICommandInput boardId={boardId} />}
      </div>
    </div>
  );
}
