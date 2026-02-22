/** Shared sticky note padding (used in ShapeRenderer + useTextEditing) */
export const STICKY_PAD_X = 12;
export const STICKY_PAD_Y = 12;

/**
 * Compute fontSize that fits text within given bounds.
 * Uses character-width estimation (no DOM measurement).
 */
export function computeStickyFontSize(
  text: string,
  availableWidth: number,
  availableHeight: number,
  maxFontSize: number = 16,
  minFontSize: number = 10
): number {
  if (!text || text.length === 0) return maxFontSize;

  for (let fs = maxFontSize; fs >= minFontSize; fs--) {
    const charWidth = fs * 0.55;
    const lineHeight = fs * 1.4;
    const charsPerLine = Math.max(1, Math.floor(availableWidth / charWidth));

    // Word-wrap estimation
    const words = text.split(/\s+/);
    let lines = 1;
    let currentLineLength = 0;
    for (const word of words) {
      if (currentLineLength + word.length > charsPerLine && currentLineLength > 0) {
        lines++;
        currentLineLength = word.length;
      } else {
        currentLineLength += (currentLineLength > 0 ? 1 : 0) + word.length;
      }
    }

    if (lines * lineHeight <= availableHeight) return fs;
  }
  return minFontSize;
}
