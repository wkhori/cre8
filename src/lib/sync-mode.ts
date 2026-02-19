/**
 * Sync mode control — allows running the canvas without Firebase writes.
 *
 * Set NEXT_PUBLIC_SYNC_MODE in .env.local:
 *   - "firebase-prod" (default) — full Firestore + RTDB sync
 *   - "render-only" — no Firebase reads/writes, pure local canvas
 */

export type SyncMode = "firebase-prod" | "render-only";

export function getSyncMode(): SyncMode {
  const mode = process.env.NEXT_PUBLIC_SYNC_MODE;
  if (mode === "render-only") return "render-only";
  return "firebase-prod";
}

export function isRenderOnly(): boolean {
  return getSyncMode() === "render-only";
}
