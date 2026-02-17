import type { Shape } from "@/lib/types";

// ── Row 1: Bold / saturated (10) ──────────────────────────────────────
export const ROW_1_COLORS = [
  "#18181b", // black
  "#71717a", // gray
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
] as const;

// ── Row 2: Soft / pastel (10) ─────────────────────────────────────────
export const ROW_2_COLORS = [
  "#d4d4d8", // light gray
  "#ffffff", // white
  "#fecdd3", // rose
  "#fed7aa", // peach
  "#fef08a", // yellow
  "#bbf7d0", // mint
  "#a5f3fc", // sky
  "#bfdbfe", // periwinkle
  "#e9d5ff", // lavender
  "#fbcfe8", // blush
] as const;

/** Vivid subset used for random shape creation */
export const VIVID_COLORS = ROW_1_COLORS.slice(2) as unknown as readonly string[];

/** Full palette: all 20 colors */
export const COLOR_PALETTE = [
  ...ROW_1_COLORS,
  ...ROW_2_COLORS,
] as const;

/**
 * Map a shape type to its primary color property key.
 */
export function getColorField(
  shapeType: string
): "fill" | "stroke" | "color" {
  switch (shapeType) {
    case "sticky":
      return "color";
    case "line":
    case "connector":
      return "stroke";
    default:
      return "fill";
  }
}

/**
 * Extract the current primary color from a shape.
 */
export function getShapeColor(shape: Shape): string {
  const field = getColorField(shape.type);
  return (shape as unknown as Record<string, unknown>)[field] as string;
}

/**
 * Returns true if a hex color is perceptually light (luminance > 0.6).
 * Used to pick contrasting check-mark colors on swatches.
 */
export function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
}
