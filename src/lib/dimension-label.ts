import type { Bounds } from "@/lib/shape-geometry";

export interface DimensionLabelMetrics {
  width: number;
  height: number;
  labelX: number;
  labelY: number;
  fontSize: number;
  padX: number;
  padY: number;
  label: string;
  labelWidth: number;
}

export function getDimensionLabelMetrics(
  bounds: Bounds,
  viewportScale: number
): DimensionLabelMetrics {
  const width = Math.round(bounds.width);
  const height = Math.round(bounds.height);
  const labelX = bounds.x + bounds.width / 2;
  const labelY = bounds.y + bounds.height + 8;
  const fontSize = 11 / viewportScale;
  const padX = 4 / viewportScale;
  const padY = 2 / viewportScale;
  const label = `${width} x ${height}`;
  const labelWidth = label.length * fontSize * 0.6;

  return {
    width,
    height,
    labelX,
    labelY,
    fontSize,
    padX,
    padY,
    label,
    labelWidth,
  };
}
