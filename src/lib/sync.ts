"use client";

import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  writeBatch,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import {
  ref,
  set as rtdbSet,
  onValue,
} from "firebase/database";
import { firebaseDb, firebaseRtdb } from "@/lib/firebase-client";
import type { Shape } from "@/lib/types";
import { generateId } from "@/lib/id";
import { throttle } from "@/lib/throttle";

// ── Board document ────────────────────────────────────────────────────

export interface BoardDoc {
  id: string;
  name: string;
  ownerId: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export async function getOrCreateBoard(
  boardId: string,
  ownerId: string
): Promise<BoardDoc> {
  const boardRef = doc(firebaseDb, "boards", boardId);
  const snapshot = await getDoc(boardRef);

  if (snapshot.exists()) {
    return { id: boardId, ...snapshot.data() } as BoardDoc;
  }

  const newBoard: Omit<BoardDoc, "id"> = {
    name: "Untitled Board",
    ownerId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(boardRef, newBoard);
  return { id: boardId, ...newBoard };
}

// ── Firestore <-> Shape serialization ─────────────────────────────────

/** Strip undefined values from an object (Firestore rejects them). */
function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Convert a local Shape to a Firestore-safe document.
 * Adds sync metadata (updatedAt, updatedBy).
 */
function shapeToFirestore(
  shape: Shape,
  userId: string
): Record<string, unknown> {
  return stripUndefined({
    ...shape,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/**
 * Convert a Firestore document back to a local Shape.
 * Strips Firestore-specific fields.
 */
function firestoreToShape(
  docId: string,
  data: Record<string, unknown>
): Shape {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { updatedAt, updatedBy, createdAt, ...shapeData } = data;
  return { ...shapeData, id: docId } as Shape;
}

// ── Object sync: Firestore listeners ──────────────────────────────────

/**
 * Subscribe to all objects in a board using incremental docChanges.
 * All changes from a single Firestore snapshot are batched and delivered
 * as one `onChanges` call to avoid cascading store updates.
 *
 * Returns an unsubscribe function.
 */
export interface BoardObjectChange {
  type: "added" | "modified" | "removed";
  shape: Shape;
}

export function subscribeBoardObjects(
  boardId: string,
  callbacks: {
    onChanges: (changes: BoardObjectChange[]) => void;
    onInitial: (shapes: Shape[]) => void;
  }
): () => void {
  const objectsRef = collection(firebaseDb, "boards", boardId, "objects");
  let isFirst = true;

  return onSnapshot(
    objectsRef,
    (snapshot) => {
      if (isFirst) {
        isFirst = false;
        const shapes: Shape[] = [];
        snapshot.forEach((docSnap) => {
          shapes.push(firestoreToShape(docSnap.id, docSnap.data()));
        });
        callbacks.onInitial(shapes);
        return;
      }

      // Batch all changes from this snapshot
      const changes: BoardObjectChange[] = [];
      for (const change of snapshot.docChanges()) {
        const shape = firestoreToShape(change.doc.id, change.doc.data());
        changes.push({ type: change.type, shape });
      }
      if (changes.length > 0) {
        callbacks.onChanges(changes);
      }
    },
    (error) => {
      // Expected during sign-out: auth token is revoked before the
      // listener cleanup runs, causing a permission-denied error.
      if (error.code !== "permission-denied") {
        console.error("Board objects snapshot error:", error);
      }
    }
  );
}

// ── Live drag sync via RTDB ──────────────────────────────────────────
// During drags, we write ephemeral position data to RTDB for near-instant
// sync (<100ms). On dragEnd we commit to Firestore (durable).

export interface LiveDragData {
  [shapeId: string]: { x: number; y: number; uid: string; ts: number };
}

/**
 * Creates a throttled broadcaster that writes dragging shape positions
 * to RTDB at ~15Hz for live preview on remote clients.
 */
export function createLiveDragBroadcaster(boardId: string, uid: string) {
  const dragRef = ref(firebaseRtdb, `boards/${boardId}/liveDrags`);

  const broadcast = throttle(
    (shapes: Array<{ id: string; x: number; y: number }>) => {
      const data: LiveDragData = {};
      for (const s of shapes) {
        data[s.id] = { x: s.x, y: s.y, uid, ts: Date.now() };
      }
      rtdbSet(dragRef, data);
    },
    66 // ~15Hz — good balance between smoothness and write volume
  );

  const clear = () => {
    rtdbSet(dragRef, null);
  };

  return { broadcast, clear };
}

/**
 * Subscribe to live drag positions from remote users. Calls `onUpdate`
 * with the current live drag overlay positions (to merge into rendering).
 */
export function subscribeLiveDrags(
  boardId: string,
  myUid: string,
  onUpdate: (drags: LiveDragData) => void
): () => void {
  const dragRef = ref(firebaseRtdb, `boards/${boardId}/liveDrags`);

  const unsubscribe = onValue(dragRef, (snapshot) => {
    const val = snapshot.val() as LiveDragData | null;
    if (!val) {
      onUpdate({});
      return;
    }
    // Filter out our own drags and stale entries (>3s old)
    const now = Date.now();
    const filtered: LiveDragData = {};
    for (const [id, data] of Object.entries(val)) {
      if (data.uid !== myUid && now - data.ts < 3000) {
        filtered[id] = data;
      }
    }
    onUpdate(filtered);
  });

  return unsubscribe;
}

// ── Board operations (write to Firestore) ─────────────────────────────
// These are the shared operations that both the UI and AI agent call.
// Each writes to Firestore; the onSnapshot listener syncs to all clients.

export async function createObject(
  boardId: string,
  shape: Shape,
  userId: string
): Promise<string> {
  const id = shape.id || generateId();
  const shapeWithId = { ...shape, id };
  const objRef = doc(firebaseDb, "boards", boardId, "objects", id);
  await setDoc(objRef, shapeToFirestore(shapeWithId, userId));
  return id;
}

export async function updateObject(
  boardId: string,
  shapeId: string,
  patch: Partial<Shape>,
  userId: string
): Promise<void> {
  const objRef = doc(firebaseDb, "boards", boardId, "objects", shapeId);
  await setDoc(
    objRef,
    stripUndefined({
      ...patch,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }),
    { merge: true }
  );
}

export async function deleteObjects(
  boardId: string,
  shapeIds: string[]
): Promise<void> {
  if (shapeIds.length === 0) return;
  const batch = writeBatch(firebaseDb);
  for (const id of shapeIds) {
    batch.delete(doc(firebaseDb, "boards", boardId, "objects", id));
  }
  await batch.commit();
}

export async function updateObjects(
  boardId: string,
  updates: Array<{ id: string; patch: Partial<Shape> }>,
  userId: string
): Promise<void> {
  if (updates.length === 0) return;
  const batch = writeBatch(firebaseDb);
  for (const { id, patch } of updates) {
    const objRef = doc(firebaseDb, "boards", boardId, "objects", id);
    batch.update(objRef, stripUndefined({
      ...patch,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }));
  }
  await batch.commit();
}
