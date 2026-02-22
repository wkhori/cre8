import type { ArchitectureAnalysis } from "./architecture-types";
import type { AIOperation } from "./ai-tools";

// ── Layout constants ──────────────────────────────────────────────
const COMPONENT_W = 180;
const COMPONENT_H = 90;
const COMPONENT_GAP = 30;
const LAYER_PAD_X = 30;
const LAYER_PAD_TOP = 50; // room for frame title
const LAYER_PAD_BOTTOM = 30;
const LAYER_GAP = 80; // vertical gap between layers
const TITLE_GAP = 50; // gap between title and first layer
const ICON_SIZE = 28;
const MAX_COMPONENTS_PER_ROW = 6;

// ── Tier color palette ────────────────────────────────────────────
const TIER_COLORS: { fill: string; text: string }[] = [
  { fill: "#3b82f6", text: "#ffffff" }, // blue — client/frontend
  { fill: "#8b5cf6", text: "#ffffff" }, // violet — API/middleware
  { fill: "#22c55e", text: "#ffffff" }, // green — services/backend
  { fill: "#f59e0b", text: "#ffffff" }, // amber — data/infrastructure
  { fill: "#ef4444", text: "#ffffff" }, // red — external/third-party
  { fill: "#06b6d4", text: "#ffffff" }, // cyan — extras
];

// Lighter versions for component boxes (backgrounds)
const TIER_COMPONENT_FILLS: string[] = [
  "#2563eb", // darker blue
  "#7c3aed", // darker violet
  "#16a34a", // darker green
  "#d97706", // darker amber
  "#dc2626", // darker red
  "#0891b2", // darker cyan
];

// ── Temp ID generation ────────────────────────────────────────────
let layoutCounter = 0;
function genTempId(): string {
  return `arch_${Date.now()}_${layoutCounter++}`;
}

/**
 * Convert an ArchitectureAnalysis into positioned AIOperation[].
 * Produces frames for layers, rects + text + optional icons for components,
 * and connectors for relationships.
 */
export function layoutArchitecture(
  arch: ArchitectureAnalysis,
  baseX: number,
  baseY: number
): AIOperation[] {
  const ops: AIOperation[] = [];
  const componentTempIds = new Map<string, string>();

  // Sort layers by tier (lowest tier = top of diagram)
  const sortedLayers = [...arch.layers].sort((a, b) => a.tier - b.tier);

  // Calculate the widest layer to make all frames uniform width
  let maxComponentsInRow = 0;
  for (const layer of sortedLayers) {
    const cols = Math.min(layer.components.length, MAX_COMPONENTS_PER_ROW);
    if (cols > maxComponentsInRow) maxComponentsInRow = cols;
  }
  const uniformLayerW = Math.max(
    LAYER_PAD_X * 2 + maxComponentsInRow * COMPONENT_W + (maxComponentsInRow - 1) * COMPONENT_GAP,
    400
  );

  // Title
  const titleId = genTempId();
  ops.push({
    type: "createText",
    tempId: titleId,
    x: baseX,
    y: baseY,
    text: arch.title,
    fontSize: 28,
    fontStyle: "bold",
    width: uniformLayerW,
  });

  // Description
  let contentY = baseY + 36;
  if (arch.description) {
    const descId = genTempId();
    ops.push({
      type: "createText",
      tempId: descId,
      x: baseX,
      y: contentY,
      text: arch.description,
      fontSize: 14,
      fill: "#71717a",
      width: uniformLayerW,
    });
    contentY += 24;
  }
  contentY += TITLE_GAP - 24;

  // Build layers
  for (const layer of sortedLayers) {
    const tierIdx = Math.min(layer.tier, TIER_COLORS.length - 1);
    const tierColor = TIER_COLORS[tierIdx];
    const compFill = TIER_COMPONENT_FILLS[tierIdx];
    const numComponents = layer.components.length;
    const cols = Math.min(numComponents, MAX_COMPONENTS_PER_ROW);
    const rows = Math.ceil(numComponents / MAX_COMPONENTS_PER_ROW);
    const layerH =
      LAYER_PAD_TOP + rows * COMPONENT_H + (rows - 1) * COMPONENT_GAP + LAYER_PAD_BOTTOM;

    // Frame for this layer
    const frameId = genTempId();
    ops.push({
      type: "createFrame",
      tempId: frameId,
      x: baseX,
      y: contentY,
      title: layer.name,
      w: uniformLayerW,
      h: layerH,
    });

    // Components inside the layer
    // Center the components horizontally within the frame
    const actualCols = Math.min(numComponents, cols);
    const contentW = actualCols * COMPONENT_W + (actualCols - 1) * COMPONENT_GAP;
    const startX = baseX + (uniformLayerW - contentW) / 2;

    for (let i = 0; i < numComponents; i++) {
      const comp = layer.components[i];
      const col = i % MAX_COMPONENTS_PER_ROW;
      const row = Math.floor(i / MAX_COMPONENTS_PER_ROW);
      const cx = startX + col * (COMPONENT_W + COMPONENT_GAP);
      const cy = contentY + LAYER_PAD_TOP + row * (COMPONENT_H + COMPONENT_GAP);

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

      // Icon (if iconSlug provided)
      const hasIcon = !!comp.iconSlug;
      const textStartX = hasIcon ? cx + ICON_SIZE + 14 : cx + 10;
      const textWidth = hasIcon ? COMPONENT_W - ICON_SIZE - 24 : COMPONENT_W - 20;

      if (hasIcon) {
        const iconId = genTempId();
        ops.push({
          type: "createImage",
          tempId: iconId,
          x: cx + 10,
          y: cy + (COMPONENT_H - ICON_SIZE) / 2,
          w: ICON_SIZE,
          h: ICON_SIZE,
          src: `https://cdn.simpleicons.org/${comp.iconSlug}/ffffff`,
        });
      }

      // Component name
      const nameId = genTempId();
      ops.push({
        type: "createText",
        tempId: nameId,
        x: textStartX,
        y: cy + 14,
        text: comp.name,
        fontSize: 13,
        fontStyle: "bold",
        fill: tierColor.text,
        width: textWidth,
      });

      // Component description or tech stack
      const subText = comp.techStack || comp.description;
      if (subText) {
        const subId = genTempId();
        ops.push({
          type: "createText",
          tempId: subId,
          x: textStartX,
          y: cy + 34,
          text: subText,
          fontSize: 11,
          fill: "rgba(255,255,255,0.75)",
          width: textWidth,
        });
      }
    }

    contentY += layerH + LAYER_GAP;
  }

  // Connectors between components
  for (const conn of arch.connections) {
    const fromTempId = componentTempIds.get(conn.from);
    const toTempId = componentTempIds.get(conn.to);
    if (!fromTempId || !toTempId) continue;

    const connId = genTempId();
    ops.push({
      type: "createConnector",
      tempId: connId,
      fromId: fromTempId,
      toId: toTempId,
      style: conn.style ?? "arrow",
      lineStyle: conn.lineStyle ?? "solid",
    });
  }

  return ops;
}
