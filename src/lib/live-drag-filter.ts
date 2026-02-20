export interface LiveDragEntry {
  x: number;
  y: number;
  uid: string;
  ts: number;
}

export type LiveDragDataLike = Record<string, LiveDragEntry>;

export function filterLiveDragData(
  raw: LiveDragDataLike,
  myUid: string,
  now: number,
  lastSeenTsById: Map<string, number>
): LiveDragDataLike {
  const filtered: LiveDragDataLike = {};
  const presentIds = new Set<string>();

  for (const [id, data] of Object.entries(raw)) {
    presentIds.add(id);
    if (data.uid === myUid) continue;
    if (now - data.ts >= 3000) continue;

    const lastSeenTs = lastSeenTsById.get(id) ?? -Infinity;
    if (data.ts <= lastSeenTs) continue;

    lastSeenTsById.set(id, data.ts);
    filtered[id] = data;
  }

  for (const id of lastSeenTsById.keys()) {
    if (!presentIds.has(id)) lastSeenTsById.delete(id);
  }

  return filtered;
}
