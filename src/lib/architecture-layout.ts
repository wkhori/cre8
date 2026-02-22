import type { ArchitectureAnalysis } from "./architecture-types";
import type { AIOperation } from "./ai-tools";

// ── Layout constants ──────────────────────────────────────────────
const COMPONENT_W = 180;
const COMPONENT_H = 90;
const COMPONENT_GAP = 30;
const LAYER_PAD_X = 30;
const LAYER_PAD_TOP = 50;
const LAYER_PAD_BOTTOM = 30;
const LAYER_GAP = 80;
const TITLE_GAP = 20;
const TECH_ICON_SIZE = 24;
const TECH_ICON_GAP = 10;
const MAX_COMPONENTS_PER_ROW = 6;
// ── Tier color palette ────────────────────────────────────────────
const TIER_COLORS: { fill: string; text: string }[] = [
  { fill: "#3b82f6", text: "#ffffff" },
  { fill: "#8b5cf6", text: "#ffffff" },
  { fill: "#22c55e", text: "#ffffff" },
  { fill: "#f59e0b", text: "#ffffff" },
  { fill: "#ef4444", text: "#ffffff" },
  { fill: "#06b6d4", text: "#ffffff" },
];

const TIER_COMPONENT_FILLS: string[] = [
  "#2563eb",
  "#7c3aed",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#0891b2",
];

// ── Temp ID generation ────────────────────────────────────────────
let layoutCounter = 0;
function genTempId(): string {
  return `arch_${Date.now()}_${layoutCounter++}`;
}

/**
 * Convert an ArchitectureAnalysis into positioned AIOperation[].
 * Produces: title, description, tech stack icon row,
 * layer frames with per-layer icon rows + component boxes, and labeled connectors.
 */
export function layoutArchitecture(
  arch: ArchitectureAnalysis,
  baseX: number,
  baseY: number
): AIOperation[] {
  const ops: AIOperation[] = [];
  const componentTempIds = new Map<string, string>();
  // Track component positions for connector label placement
  const componentPositions = new Map<string, { x: number; y: number; w: number; h: number }>();

  const sortedLayers = [...arch.layers].sort((a, b) => a.tier - b.tier);

  // Calculate uniform layer width
  let maxComponentsInRow = 0;
  for (const layer of sortedLayers) {
    const cols = Math.min(layer.components.length, MAX_COMPONENTS_PER_ROW);
    if (cols > maxComponentsInRow) maxComponentsInRow = cols;
  }
  const uniformLayerW = Math.max(
    LAYER_PAD_X * 2 + maxComponentsInRow * COMPONENT_W + (maxComponentsInRow - 1) * COMPONENT_GAP,
    500
  );

  const diagramX = baseX;

  // ── Title ───────────────────────────────────────────────────────
  ops.push({
    type: "createText",
    tempId: genTempId(),
    x: diagramX,
    y: baseY,
    text: arch.title,
    fontSize: 28,
    fontStyle: "bold",
    width: uniformLayerW,
  });

  let contentY = baseY + 36;

  // ── Description ─────────────────────────────────────────────────
  if (arch.description) {
    ops.push({
      type: "createText",
      tempId: genTempId(),
      x: diagramX,
      y: contentY,
      text: arch.description,
      fontSize: 14,
      fill: "#71717a",
      width: uniformLayerW,
    });
    contentY += 24;
  }

  // ── Tech Stack Icon Row ─────────────────────────────────────────
  if (arch.techStackIcons && arch.techStackIcons.length > 0) {
    contentY += 12;
    // Background rect for the icon row
    const iconRowW =
      arch.techStackIcons.length * (TECH_ICON_SIZE + TECH_ICON_GAP) - TECH_ICON_GAP + 20;
    ops.push({
      type: "createShape",
      tempId: genTempId(),
      shapeType: "rectangle",
      x: diagramX,
      y: contentY,
      w: iconRowW,
      h: TECH_ICON_SIZE + 16,
      fill: "#27272a",
    });

    for (let i = 0; i < arch.techStackIcons.length; i++) {
      ops.push({
        type: "createImage",
        tempId: genTempId(),
        x: diagramX + 10 + i * (TECH_ICON_SIZE + TECH_ICON_GAP),
        y: contentY + 8,
        w: TECH_ICON_SIZE,
        h: TECH_ICON_SIZE,
        src: `https://cdn.simpleicons.org/${arch.techStackIcons[i]}/ffffff`,
      });
    }
    contentY += TECH_ICON_SIZE + 16;
  }

  contentY += TITLE_GAP;

  // ── Layers ──────────────────────────────────────────────────────
  for (const layer of sortedLayers) {
    const tierIdx = Math.min(layer.tier, TIER_COLORS.length - 1);
    const tierColor = TIER_COLORS[tierIdx];
    const compFill = TIER_COMPONENT_FILLS[tierIdx];
    const numComponents = layer.components.length;
    const cols = Math.min(numComponents, MAX_COMPONENTS_PER_ROW);
    const rows = Math.ceil(numComponents / MAX_COMPONENTS_PER_ROW);
    const layerH =
      LAYER_PAD_TOP + rows * COMPONENT_H + (rows - 1) * COMPONENT_GAP + LAYER_PAD_BOTTOM;

    // Frame
    ops.push({
      type: "createFrame",
      tempId: genTempId(),
      x: diagramX,
      y: contentY,
      title: layer.name,
      w: uniformLayerW,
      h: layerH,
    });

    // Center components horizontally
    const actualCols = Math.min(numComponents, cols);
    const contentW = actualCols * COMPONENT_W + (actualCols - 1) * COMPONENT_GAP;
    const startX = diagramX + (uniformLayerW - contentW) / 2;

    for (let i = 0; i < numComponents; i++) {
      const comp = layer.components[i];
      const col = i % MAX_COMPONENTS_PER_ROW;
      const row = Math.floor(i / MAX_COMPONENTS_PER_ROW);
      const cx = startX + col * (COMPONENT_W + COMPONENT_GAP);
      const cy = contentY + LAYER_PAD_TOP + row * (COMPONENT_H + COMPONENT_GAP);

      // Track position for connector labels
      componentPositions.set(comp.id, { x: cx, y: cy, w: COMPONENT_W, h: COMPONENT_H });

      // Component rectangle
      const rectId = genTempId();
      componentTempIds.set(comp.id, rectId);
      ops.push({
        type: "createShape",
        tempId: rectId,
        shapeType: "rectangle",
        x: cx,
        y: cy,
        w: COMPONENT_W,
        h: COMPONENT_H,
        fill: compFill,
      });

      // Component name
      ops.push({
        type: "createText",
        tempId: genTempId(),
        x: cx + 10,
        y: cy + 14,
        text: comp.name,
        fontSize: 13,
        fontStyle: "bold",
        fill: tierColor.text,
        width: COMPONENT_W - 20,
      });

      // Description / tech stack
      const subText = comp.techStack || comp.description;
      if (subText) {
        ops.push({
          type: "createText",
          tempId: genTempId(),
          x: cx + 10,
          y: cy + 34,
          text: subText,
          fontSize: 11,
          fill: "rgba(255,255,255,0.75)",
          width: COMPONENT_W - 20,
        });
      }
    }

    // Per-layer icon row in top-right corner of the frame
    const layerIcons = layer.components
      .map((c) => c.iconSlug)
      .filter((slug): slug is string => !!slug);
    const uniqueIcons = [...new Set(layerIcons)];
    if (uniqueIcons.length > 0) {
      const iconRowW = uniqueIcons.length * (TECH_ICON_SIZE + TECH_ICON_GAP) - TECH_ICON_GAP + 16;
      const iconRowH = TECH_ICON_SIZE + 12;
      const iconRowX = diagramX + uniformLayerW - iconRowW - 10;
      const iconRowY = contentY + 8;

      // Dark background rect
      ops.push({
        type: "createShape",
        tempId: genTempId(),
        shapeType: "rectangle",
        x: iconRowX,
        y: iconRowY,
        w: iconRowW,
        h: iconRowH,
        fill: "#27272a",
      });

      // Icon images
      for (let i = 0; i < uniqueIcons.length; i++) {
        ops.push({
          type: "createImage",
          tempId: genTempId(),
          x: iconRowX + 8 + i * (TECH_ICON_SIZE + TECH_ICON_GAP),
          y: iconRowY + 6,
          w: TECH_ICON_SIZE,
          h: TECH_ICON_SIZE,
          src: `https://cdn.simpleicons.org/${uniqueIcons[i]}/ffffff`,
        });
      }
    }

    contentY += layerH + LAYER_GAP;
  }

  // ── Connectors with labels ──────────────────────────────────────
  for (const conn of arch.connections) {
    const fromTempId = componentTempIds.get(conn.from);
    const toTempId = componentTempIds.get(conn.to);
    if (!fromTempId || !toTempId) continue;

    ops.push({
      type: "createConnector",
      tempId: genTempId(),
      fromId: fromTempId,
      toId: toTempId,
      style: conn.style ?? "arrow",
      lineStyle: conn.lineStyle ?? "solid",
      routingMode: "curved",
    });

    // Add label text at the midpoint of the connection
    if (conn.label) {
      const fromPos = componentPositions.get(conn.from);
      const toPos = componentPositions.get(conn.to);
      if (fromPos && toPos) {
        const midX = (fromPos.x + fromPos.w / 2 + toPos.x + toPos.w / 2) / 2;
        const midY = (fromPos.y + fromPos.h / 2 + toPos.y + toPos.h / 2) / 2;
        ops.push({
          type: "createText",
          tempId: genTempId(),
          x: midX - 40,
          y: midY - 8,
          text: conn.label,
          fontSize: 10,
          fill: "#a1a1aa",
          width: 80,
        });
      }
    }
  }

  return ops;
}
