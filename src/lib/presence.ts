"use client";

import { ref, set, onValue, onDisconnect, serverTimestamp } from "firebase/database";
import { firebaseRtdb } from "@/lib/firebase-client";
import { throttle } from "@/lib/throttle";

// ── Cursor colors palette ────────────────────────────────────────────
const CURSOR_COLORS = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#14b8a6", // teal
  "#a855f7", // purple
];

export function getCursorColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = ((hash << 5) - hash + uid.charCodeAt(i)) | 0;
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

// ── Types ────────────────────────────────────────────────────────────
export interface CursorPosition {
  uid: string;
  displayName: string;
  color: string;
  x: number;
  y: number;
  lastUpdated: number;
}

export interface PresenceUser {
  uid: string;
  displayName: string;
  photoURL: string | null;
  color: string;
  online: boolean;
  lastSeen: number;
}

// ── Presence: join/leave board ────────────────────────────────────────

export function joinBoard(
  boardId: string,
  uid: string,
  displayName: string,
  photoURL: string | null
) {
  const color = getCursorColor(uid);
  const presenceRef = ref(firebaseRtdb, `boards/${boardId}/presence/${uid}`);

  const data: PresenceUser = {
    uid,
    displayName,
    photoURL,
    color,
    online: true,
    lastSeen: Date.now(),
  };

  set(presenceRef, data);

  // When the client disconnects, mark offline
  onDisconnect(presenceRef).update({
    online: false,
    lastSeen: serverTimestamp(),
  });

  // Heartbeat: update lastSeen every 30s so stale sessions get filtered out
  let stopped = false;
  const heartbeat = setInterval(() => {
    if (stopped) return;
    set(presenceRef, { ...data, lastSeen: Date.now() });
  }, 30_000);

  return async () => {
    // Stop heartbeat FIRST to prevent race where heartbeat overwrites online:false
    stopped = true;
    clearInterval(heartbeat);
    await set(presenceRef, { ...data, online: false, lastSeen: Date.now() }).catch(() => {}); // expected during sign-out;
  };
}

// ── Presence listener ────────────────────────────────────────────────

export function subscribePresence(
  boardId: string,
  callback: (users: PresenceUser[]) => void
): () => void {
  const presenceRef = ref(firebaseRtdb, `boards/${boardId}/presence`);

  const unsubscribe = onValue(
    presenceRef,
    (snapshot) => {
      const val = snapshot.val() as Record<string, PresenceUser> | null;
      if (!val) {
        callback([]);
        return;
      }
      const users = Object.values(val);
      callback(users);
    },
    () => {} // expected during sign-out
  );

  return unsubscribe;
}

// ── Cursor broadcast (throttled to ~30Hz) ────────────────────────────

export function createCursorBroadcaster(boardId: string, uid: string, displayName: string) {
  const color = getCursorColor(uid);
  const cursorRef = ref(firebaseRtdb, `boards/${boardId}/cursors/${uid}`);

  let stopped = false;

  const broadcast = throttle((x: number, y: number) => {
    if (stopped) return;
    const data: CursorPosition = {
      uid,
      displayName,
      color,
      x,
      y,
      lastUpdated: Date.now(),
    };
    set(cursorRef, data);
  }, 33); // ~30fps

  const cleanup = async () => {
    stopped = true;
    await set(cursorRef, null).catch(() => {}); // expected during sign-out;
  };

  // Remove cursor data on disconnect
  onDisconnect(cursorRef).remove();

  return { broadcast, cleanup };
}

// ── Cursor listener ─────────────────────────────────────────────────

export function subscribeCursors(
  boardId: string,
  myUid: string,
  callback: (cursors: CursorPosition[]) => void
): () => void {
  const cursorsRef = ref(firebaseRtdb, `boards/${boardId}/cursors`);

  const unsubscribe = onValue(
    cursorsRef,
    (snapshot) => {
      const val = snapshot.val() as Record<string, CursorPosition> | null;
      if (!val) {
        callback([]);
        return;
      }
      // Filter out own cursor
      const cursors = Object.values(val).filter((c) => c.uid !== myUid);
      callback(cursors);
    },
    () => {} // expected during sign-out
  );

  return unsubscribe;
}
