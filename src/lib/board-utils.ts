/** Gradient palette for board card preview placeholders. */
export const BOARD_GRADIENTS = [
  "from-violet-500/20 to-blue-500/20",
  "from-amber-500/20 to-rose-500/20",
  "from-emerald-500/20 to-cyan-500/20",
  "from-rose-500/20 to-purple-500/20",
  "from-sky-500/20 to-indigo-500/20",
  "from-teal-500/20 to-lime-500/20",
];

/** Pick a consistent gradient for a board based on its ID. */
export function pickGradient(boardId: string): string {
  let hash = 0;
  for (let i = 0; i < boardId.length; i++) {
    hash = (hash * 31 + boardId.charCodeAt(i)) | 0;
  }
  return BOARD_GRADIENTS[Math.abs(hash) % BOARD_GRADIENTS.length];
}

/**
 * Safely extract a millisecond timestamp from a Firestore value.
 * Handles raw numbers, Firestore Timestamp objects, and fallback to Date.now().
 */
export function getTimestamp(ts: unknown): number {
  if (typeof ts === "number") return ts;
  if (
    ts &&
    typeof ts === "object" &&
    "toMillis" in ts &&
    typeof (ts as { toMillis: () => number }).toMillis === "function"
  ) {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}
