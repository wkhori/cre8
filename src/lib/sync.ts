"use client";

import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  writeBatch,
  serverTimestamp,
  getDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  orderBy,
} from "firebase/firestore";
import { ref, set as rtdbSet, onValue } from "firebase/database";
import { firebaseDb, firebaseRtdb } from "@/lib/firebase-client";
import type { Shape } from "@/lib/types";
import { generateId } from "@/lib/id";

// ── Board document ────────────────────────────────────────────────────

export interface BoardOwner {
  uid: string;
  name: string;
  photoURL: string | null;
}

export interface BoardDoc {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  ownerPhotoURL: string | null;
  favoriteOf: string[];
  createdAt: unknown;
  updatedAt: unknown;
}

export async function getOrCreateBoard(boardId: string, owner: BoardOwner): Promise<BoardDoc> {
  const boardRef = doc(firebaseDb, "boards", boardId);
  const snapshot = await getDoc(boardRef);

  if (snapshot.exists()) {
    const data = snapshot.data();
    return {
      id: boardId,
      name: data.name ?? "Untitled Board",
      ownerId: data.ownerId ?? owner.uid,
      ownerName: data.ownerName ?? owner.name,
      ownerPhotoURL: data.ownerPhotoURL ?? null,
      favoriteOf: data.favoriteOf ?? [],
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    } as BoardDoc;
  }

  const newBoard: Omit<BoardDoc, "id"> = {
    name: "Untitled Board",
    ownerId: owner.uid,
    ownerName: owner.name,
    ownerPhotoURL: owner.photoURL,
    favoriteOf: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(boardRef, newBoard);
  return { id: boardId, ...newBoard };
}

// ── Board CRUD ───────────────────────────────────────────────────────

export async function listUserBoards(uid: string): Promise<BoardDoc[]> {
  const q = query(
    collection(firebaseDb, "boards"),
    where("ownerId", "==", uid),
    orderBy("updatedAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    name: d.data().name ?? "Untitled Board",
    ownerId: d.data().ownerId,
    ownerName: d.data().ownerName ?? "Unknown",
    ownerPhotoURL: d.data().ownerPhotoURL ?? null,
    favoriteOf: d.data().favoriteOf ?? [],
    createdAt: d.data().createdAt,
    updatedAt: d.data().updatedAt,
  }));
}

export async function listFavoritedBoards(uid: string): Promise<BoardDoc[]> {
  const q = query(
    collection(firebaseDb, "boards"),
    where("favoriteOf", "array-contains", uid),
    orderBy("updatedAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    name: d.data().name ?? "Untitled Board",
    ownerId: d.data().ownerId,
    ownerName: d.data().ownerName ?? "Unknown",
    ownerPhotoURL: d.data().ownerPhotoURL ?? null,
    favoriteOf: d.data().favoriteOf ?? [],
    createdAt: d.data().createdAt,
    updatedAt: d.data().updatedAt,
  }));
}

export async function createBoard(name: string, owner: BoardOwner): Promise<BoardDoc> {
  const boardId = crypto.randomUUID();
  const boardRef = doc(firebaseDb, "boards", boardId);
  const newBoard: Omit<BoardDoc, "id"> = {
    name,
    ownerId: owner.uid,
    ownerName: owner.name,
    ownerPhotoURL: owner.photoURL,
    favoriteOf: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(boardRef, newBoard);
  return { id: boardId, ...newBoard };
}

export async function updateBoard(
  boardId: string,
  patch: Partial<Pick<BoardDoc, "name">>
): Promise<void> {
  const boardRef = doc(firebaseDb, "boards", boardId);
  await updateDoc(boardRef, {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteBoard(boardId: string): Promise<void> {
  // Delete all objects in the subcollection first
  const objectsRef = collection(firebaseDb, "boards", boardId, "objects");
  const snapshot = await getDocs(objectsRef);

  if (snapshot.size > 0) {
    // Firestore batch limit is 500 writes
    const batchSize = 500;
    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = writeBatch(firebaseDb);
      const chunk = docs.slice(i, i + batchSize);
      for (const d of chunk) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }
  }

  // Delete the board document itself
  await deleteDoc(doc(firebaseDb, "boards", boardId));

  // Clean up RTDB data (cursors, presence, liveDrags)
  const boardRtdbRef = ref(firebaseRtdb, `boards/${boardId}`);
  await rtdbSet(boardRtdbRef, null).catch(() => {});
}

export async function duplicateBoard(
  sourceBoardId: string,
  newName: string,
  owner: BoardOwner
): Promise<BoardDoc> {
  // Read all objects from the source board
  const objectsRef = collection(firebaseDb, "boards", sourceBoardId, "objects");
  const snapshot = await getDocs(objectsRef);

  // Create the new board
  const newBoard = await createBoard(newName, owner);

  // Copy all objects to the new board with new IDs
  if (snapshot.size > 0) {
    // Build old→new ID mapping so connectors can remap fromId/toId
    const idMap = new Map<string, string>();
    for (const d of snapshot.docs) {
      idMap.set(d.id, generateId());
    }

    const batchSize = 500;
    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = writeBatch(firebaseDb);
      const chunk = docs.slice(i, i + batchSize);
      for (const d of chunk) {
        const newId = idMap.get(d.id)!;
        const newObjRef = doc(firebaseDb, "boards", newBoard.id, "objects", newId);
        const data = d.data();
        // Remap connector references to new shape IDs
        if (data.type === "connector") {
          if (data.fromId && idMap.has(data.fromId)) data.fromId = idMap.get(data.fromId);
          if (data.toId && idMap.has(data.toId)) data.toId = idMap.get(data.toId);
        }
        batch.set(newObjRef, {
          ...data,
          id: newId,
          updatedAt: serverTimestamp(),
          updatedBy: owner.uid,
        });
      }
      await batch.commit();
    }
  }

  return newBoard;
}

export async function toggleFavorite(
  boardId: string,
  uid: string,
  isFavorited: boolean
): Promise<void> {
  const boardRef = doc(firebaseDb, "boards", boardId);
  await updateDoc(boardRef, {
    favoriteOf: isFavorited ? arrayRemove(uid) : arrayUnion(uid),
  });
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
function shapeToFirestore(shape: Shape, userId: string): Record<string, unknown> {
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
function firestoreToShape(docId: string, data: Record<string, unknown>): Shape {
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
        // Ignore local pending writes; those are already represented by local state.
        if (change.doc.metadata.hasPendingWrites) continue;
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
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: Array<{ id: string; x: number; y: number }> | null = null;
  let lastSentAt = 0;
  let lastSignature = "";

  const getIntervalMs = (count: number) => {
    if (count <= 50) return 66;
    if (count <= 200) return 120;
    return 200;
  };

  const quantize = (value: number) => Math.round(value / 2) * 2;

  const buildPayload = (shapes: Array<{ id: string; x: number; y: number }>) => {
    const byId = new Map<string, { x: number; y: number }>();
    for (const shape of shapes) {
      byId.set(shape.id, { x: quantize(shape.x), y: quantize(shape.y) });
    }

    const entries = [...byId.entries()].sort(([a], [b]) => a.localeCompare(b));
    const signature = entries.map(([id, p]) => `${id}:${p.x}:${p.y}`).join("|");

    const data: LiveDragData = {};
    const ts = Date.now();
    for (const [id, p] of entries) {
      data[id] = { x: p.x, y: p.y, uid, ts };
    }

    return { data, signature, count: entries.length };
  };

  const flush = () => {
    timer = null;
    if (!pending) return;

    const shapes = pending;
    pending = null;
    const { data, signature, count } = buildPayload(shapes);
    if (count === 0) return;

    if (signature !== lastSignature) {
      lastSignature = signature;
      lastSentAt = Date.now();
      rtdbSet(dragRef, data).catch(() => {});
    }

    if (pending) {
      schedule();
    }
  };

  const schedule = () => {
    if (!pending || timer) return;
    const intervalMs = getIntervalMs(pending.length);
    const elapsedMs = Date.now() - lastSentAt;
    const waitMs = Math.max(0, intervalMs - elapsedMs);
    timer = setTimeout(flush, waitMs);
  };

  const broadcast = (shapes: Array<{ id: string; x: number; y: number }>) => {
    pending = shapes;
    schedule();
  };

  const clear = () => {
    pending = null;
    lastSignature = "";
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    rtdbSet(dragRef, null).catch(() => {}); // expected during sign-out
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

  const unsubscribe = onValue(
    dragRef,
    (snapshot) => {
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
    },
    () => {} // expected during sign-out
  );

  return unsubscribe;
}

// ── Board operations (write to Firestore) ─────────────────────────────
// These are the shared operations that both the UI and AI agent call.
// Each writes to Firestore; the onSnapshot listener syncs to all clients.

export async function createObject(boardId: string, shape: Shape, userId: string): Promise<string> {
  const id = shape.id || generateId();
  const shapeWithId = { ...shape, id };
  const objRef = doc(firebaseDb, "boards", boardId, "objects", id);
  await setDoc(objRef, shapeToFirestore(shapeWithId, userId));
  return id;
}

export async function createObjects(
  boardId: string,
  shapes: Shape[],
  userId: string
): Promise<void> {
  if (shapes.length === 0) return;
  // Firestore batch limit is 500 writes
  const batchSize = 500;
  for (let i = 0; i < shapes.length; i += batchSize) {
    const batch = writeBatch(firebaseDb);
    const chunk = shapes.slice(i, i + batchSize);
    for (const shape of chunk) {
      const id = shape.id || generateId();
      const shapeWithId = { ...shape, id };
      const objRef = doc(firebaseDb, "boards", boardId, "objects", id);
      batch.set(objRef, shapeToFirestore(shapeWithId, userId));
    }
    await batch.commit();
  }
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

export async function deleteObjects(boardId: string, shapeIds: string[]): Promise<void> {
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
    batch.update(
      objRef,
      stripUndefined({
        ...patch,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      })
    );
  }
  await batch.commit();
}
