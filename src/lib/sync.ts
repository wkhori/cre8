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
  deleteField,
} from "firebase/firestore";
import { ref, set as rtdbSet, onValue } from "firebase/database";
import { firebaseDb, firebaseRtdb } from "@/lib/firebase-client";
import type { Shape } from "@/lib/types";
import { generateId } from "@/lib/id";
import { throttle } from "@/lib/throttle";
import { filterLiveDragData } from "@/lib/live-drag-filter";

const FIRESTORE_BATCH_WRITE_LIMIT = 499;

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

/** Bump the board document's updatedAt timestamp (throttled per board). */
const _boardTsLastTouched = new Map<string, number>();
const BOARD_TS_THROTTLE_MS = 30_000;

export function touchBoardTimestamp(boardId: string): void {
  const now = Date.now();
  const last = _boardTsLastTouched.get(boardId) ?? 0;
  if (now - last < BOARD_TS_THROTTLE_MS) return;
  _boardTsLastTouched.set(boardId, now);
  const boardRef = doc(firebaseDb, "boards", boardId);
  updateDoc(boardRef, { updatedAt: serverTimestamp() }).catch(() => {});
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
 * After stripUndefined, restore fields that were explicitly set to undefined
 * as Firestore deleteField() sentinels. With merge:true, omitting a key
 * preserves its old value — deleteField() is the only way to actually remove it.
 */
function applyFieldDeletions(
  result: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  if ("parentId" in source && source.parentId === undefined) {
    result.parentId = deleteField();
  }
  return result;
}

/**
 * Convert a local Shape to a Firestore-safe document.
 * Adds sync metadata (updatedAt, updatedBy).
 */
function shapeToFirestore(shape: Shape, userId: string): Record<string, unknown> {
  return applyFieldDeletions(
    stripUndefined({
      ...shape,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }),
    shape as unknown as Record<string, unknown>
  );
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

interface UserLiveDragPayload {
  __clearTs?: number;
  [shapeId: string]: { x: number; y: number; ts: number } | number | undefined;
}

/**
 * Creates a throttled broadcaster that writes dragging shape positions
 * to RTDB at ~15Hz for live preview on remote clients.
 */
export function createLiveDragBroadcaster(boardId: string, uid: string) {
  const dragRef = ref(firebaseRtdb, `boards/${boardId}/liveDrags/${uid}`);
  let lastTs = 0;

  const nextTs = () => {
    const now = Date.now();
    if (now <= lastTs) {
      lastTs += 1;
    } else {
      lastTs = now;
    }
    return lastTs;
  };

  const broadcast = throttle(
    (shapes: Array<{ id: string; x: number; y: number }>) => {
      const ts = nextTs();
      const data: UserLiveDragPayload = {};
      for (const s of shapes) {
        data[s.id] = { x: s.x, y: s.y, ts };
      }
      rtdbSet(dragRef, data);
    },
    33 // ~30Hz — matches cursor broadcast rate, lerp smooths on receiver
  );

  const clear = () => {
    broadcast.cancel();
    rtdbSet(dragRef, { __clearTs: nextTs() }).catch(() => {}); // expected during sign-out
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
  const lastSeenTsById = new Map<string, number>();
  const lastClearTsByUid = new Map<string, number>();

  const unsubscribe = onValue(
    dragRef,
    (snapshot) => {
      const val = snapshot.val() as Record<string, UserLiveDragPayload> | null;
      if (!val) {
        onUpdate({});
        return;
      }
      const flattened: LiveDragData = {};
      const presentUids = new Set<string>();
      for (const [uid, payload] of Object.entries(val)) {
        presentUids.add(uid);
        if (uid === myUid || !payload) continue;

        const clearTs = typeof payload.__clearTs === "number" ? payload.__clearTs : undefined;
        if (clearTs != null) {
          const prev = lastClearTsByUid.get(uid) ?? -Infinity;
          if (clearTs > prev) lastClearTsByUid.set(uid, clearTs);
        }

        const uidClearTs = lastClearTsByUid.get(uid) ?? -Infinity;
        for (const [shapeId, entry] of Object.entries(payload)) {
          if (shapeId === "__clearTs") continue;
          if (
            !entry ||
            typeof entry !== "object" ||
            typeof entry.x !== "number" ||
            typeof entry.y !== "number" ||
            typeof entry.ts !== "number"
          ) {
            continue;
          }
          if (entry.ts <= uidClearTs) continue;

          const existing = flattened[shapeId];
          if (!existing || entry.ts > existing.ts) {
            flattened[shapeId] = { x: entry.x, y: entry.y, uid, ts: entry.ts };
          }
        }
      }

      for (const uid of lastClearTsByUid.keys()) {
        if (!presentUids.has(uid)) lastClearTsByUid.delete(uid);
      }

      const filtered = filterLiveDragData(
        flattened,
        myUid,
        Date.now(),
        lastSeenTsById
      ) as LiveDragData;
      onUpdate(filtered);
    },
    () => {} // expected during sign-out
  );

  return unsubscribe;
}

// ── Board operations (write to Firestore) ─────────────────────────────
// These are the shared operations that both the UI and AI agent call.
// Each writes to Firestore; the onSnapshot listener syncs to all clients.

export async function createObjects(
  boardId: string,
  shapes: Shape[],
  userId: string
): Promise<void> {
  if (shapes.length === 0) return;
  for (let i = 0; i < shapes.length; i += FIRESTORE_BATCH_WRITE_LIMIT) {
    const batch = writeBatch(firebaseDb);
    const chunk = shapes.slice(i, i + FIRESTORE_BATCH_WRITE_LIMIT);
    for (const shape of chunk) {
      const id = shape.id || generateId();
      const objRef = doc(firebaseDb, "boards", boardId, "objects", id);
      batch.set(objRef, shapeToFirestore({ ...shape, id }, userId));
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
    applyFieldDeletions(
      stripUndefined({
        ...patch,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      }),
      patch as unknown as Record<string, unknown>
    ),
    { merge: true }
  );
}

export async function deleteObjects(boardId: string, shapeIds: string[]): Promise<void> {
  if (shapeIds.length === 0) return;
  for (let i = 0; i < shapeIds.length; i += FIRESTORE_BATCH_WRITE_LIMIT) {
    const batch = writeBatch(firebaseDb);
    const chunk = shapeIds.slice(i, i + FIRESTORE_BATCH_WRITE_LIMIT);
    for (const id of chunk) {
      batch.delete(doc(firebaseDb, "boards", boardId, "objects", id));
    }
    await batch.commit();
  }
}

export async function updateObjects(
  boardId: string,
  updates: Array<{ id: string; patch: Partial<Shape> }>,
  userId: string
): Promise<void> {
  if (updates.length === 0) return;
  for (let i = 0; i < updates.length; i += FIRESTORE_BATCH_WRITE_LIMIT) {
    const batch = writeBatch(firebaseDb);
    const chunk = updates.slice(i, i + FIRESTORE_BATCH_WRITE_LIMIT);
    for (const { id, patch } of chunk) {
      const objRef = doc(firebaseDb, "boards", boardId, "objects", id);
      batch.set(
        objRef,
        applyFieldDeletions(
          stripUndefined({
            ...patch,
            updatedAt: serverTimestamp(),
            updatedBy: userId,
          }),
          patch as unknown as Record<string, unknown>
        ),
        { merge: true }
      );
    }
    await batch.commit();
  }
}
