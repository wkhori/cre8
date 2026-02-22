import type Konva from "konva";
import type { Shape } from "@/lib/types";
import { getShapeBounds, computeConnectorPoints } from "@/lib/shape-geometry";

interface ExportOptions {
  format: "png" | "jpg";
  shapes: Shape[];
  selectedIds: string[];
  scope: "board" | "selection";
  pixelRatio?: number;
}

export function exportCanvasAsImage(
  stage: Konva.Stage,
  layer: Konva.Layer,
  options: ExportOptions
): void {
  const { format, shapes, selectedIds, scope, pixelRatio = 2 } = options;

  const targetIds = scope === "selection" ? new Set(selectedIds) : null;
  const targetShapes = targetIds ? shapes.filter((s) => targetIds.has(s.id)) : shapes;

  if (targetShapes.length === 0) return;

  // Compute bounding box of target shapes
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const shape of targetShapes) {
    if (shape.type === "connector") {
      const pts = computeConnectorPoints(shape, shapes);
      for (let i = 0; i < pts.length; i += 2) {
        minX = Math.min(minX, pts[i]);
        minY = Math.min(minY, pts[i + 1]);
        maxX = Math.max(maxX, pts[i]);
        maxY = Math.max(maxY, pts[i + 1]);
      }
    } else {
      const b = getShapeBounds(shape);
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    }
  }

  const padding = 40;
  const exportX = minX - padding;
  const exportY = minY - padding;
  const exportW = maxX - minX + padding * 2;
  const exportH = maxY - minY + padding * 2;

  // Clamp pixelRatio to avoid exceeding browser canvas limits
  const safeRatio = Math.min(pixelRatio, 8192 / Math.max(exportW, exportH));

  // Save stage transform
  const oldScaleX = stage.scaleX();
  const oldScaleY = stage.scaleY();
  const oldPos = stage.position();

  // Reset to identity so world coords = stage coords
  stage.scale({ x: 1, y: 1 });
  stage.position({ x: 0, y: 0 });

  // For selection export, hide non-selected shape nodes
  const hiddenNodes: Konva.Node[] = [];
  if (targetIds) {
    const allNodes = layer.find(".canvas-shape");
    for (const node of allNodes) {
      if (!targetIds.has(node.id())) {
        node.visible(false);
        hiddenNodes.push(node);
      }
    }
  }

  // Hide Transformer
  const transformer = layer.findOne("Transformer");
  const wasTransformerVisible = transformer?.visible();
  transformer?.visible(false);

  try {
    const dataURL = layer.toDataURL({
      x: exportX,
      y: exportY,
      width: exportW,
      height: exportH,
      pixelRatio: safeRatio,
      mimeType: format === "jpg" ? "image/jpeg" : "image/png",
      quality: format === "jpg" ? 0.92 : undefined,
    });

    const link = document.createElement("a");
    link.download = `board-export.${format === "jpg" ? "jpg" : "png"}`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    // Restore everything
    for (const node of hiddenNodes) {
      node.visible(true);
    }
    if (transformer && wasTransformerVisible !== undefined) {
      transformer.visible(wasTransformerVisible);
    }
    stage.scale({ x: oldScaleX, y: oldScaleY });
    stage.position(oldPos);
    stage.batchDraw();
  }
}
