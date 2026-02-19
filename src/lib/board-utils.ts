/** Gradient palette for board card preview placeholders. */
export const BOARD_GRADIENTS = [
  "from-violet-500/30 to-blue-500/20",
  "from-amber-500/30 to-rose-500/20",
  "from-emerald-500/30 to-cyan-500/20",
  "from-rose-500/30 to-purple-500/20",
  "from-sky-500/30 to-indigo-500/20",
  "from-teal-500/30 to-lime-500/20",
  "from-fuchsia-500/30 to-pink-500/20",
  "from-orange-500/30 to-amber-500/20",
];

// ── Random board name generator ──────────────────────────────────────

const ADJECTIVES = [
  "Bold",
  "Bright",
  "Cosmic",
  "Creative",
  "Crystal",
  "Dreamy",
  "Electric",
  "Epic",
  "Fresh",
  "Golden",
  "Grand",
  "Happy",
  "Infinite",
  "Lucky",
  "Mighty",
  "Neon",
  "Noble",
  "Pixel",
  "Quantum",
  "Rapid",
  "Serene",
  "Sleek",
  "Snappy",
  "Solar",
  "Spark",
  "Stellar",
  "Swift",
  "Turbo",
  "Ultra",
  "Vivid",
  "Wild",
  "Zen",
];

const NOUNS = [
  "Atlas",
  "Blueprint",
  "Canvas",
  "Draft",
  "Flow",
  "Grid",
  "Hub",
  "Ideas",
  "Jam",
  "Lab",
  "Map",
  "Nexus",
  "Orbit",
  "Pad",
  "Plan",
  "Quest",
  "Realm",
  "Sketch",
  "Space",
  "Sprint",
  "Studio",
  "Think",
  "Vault",
  "Vision",
  "Wave",
  "Workshop",
  "Zone",
];

/** Generate a random, memorable board name like "Bold Canvas" or "Neon Sprint". */
export function randomBoardName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj} ${noun}`;
}

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
