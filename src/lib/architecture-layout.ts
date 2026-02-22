import type { ArchitectureAnalysis, ArchitectureLayer } from "./architecture-types";
import type { AIOperation } from "./ai-tools";

// ── Layout constants ──────────────────────────────────────────────
const COMPONENT_W = 220;
const COMPONENT_H = 100;
const COMPONENT_GAP = 28;
const COMPONENT_CORNER_R = 14;
const LAYER_PAD_X = 36;
const LAYER_PAD_TOP = 56;
const LAYER_PAD_BOTTOM = 32;
const LAYER_GAP = 56;
const TIER_GROUP_GAP = 24;
const TITLE_GAP = 24;
const TECH_ICON_SIZE = 24;
const TECH_ICON_GAP = 12;
const MAX_COMPONENTS_PER_ROW = 5;
const HEADER_BAND_H = 36;
const HEADER_CORNER_R = 12;
const SHADOW_DX = 4;
const SHADOW_DY = 4;
const BACKDROP_PAD = 48;
const BACKDROP_CORNER_R = 24;

// ── Apple-inspired tier palette ──────────────────────────────────
interface TierPalette {
  card: string;
  header: string;
  border: string;
  text: string;
  subtext: string;
}

const TIER_PALETTES: TierPalette[] = [
  {
    card: "#1e293b",
    header: "#3b82f6",
    border: "rgba(59,130,246,0.25)",
    text: "#e2e8f0",
    subtext: "rgba(226,232,240,0.55)",
  },
  {
    card: "#1e1b2e",
    header: "#8b5cf6",
    border: "rgba(139,92,246,0.25)",
    text: "#e2e8f0",
    subtext: "rgba(226,232,240,0.55)",
  },
  {
    card: "#162623",
    header: "#22c55e",
    border: "rgba(34,197,94,0.25)",
    text: "#e2e8f0",
    subtext: "rgba(226,232,240,0.55)",
  },
  {
    card: "#271e14",
    header: "#f59e0b",
    border: "rgba(245,158,11,0.25)",
    text: "#e2e8f0",
    subtext: "rgba(226,232,240,0.55)",
  },
  {
    card: "#271717",
    header: "#ef4444",
    border: "rgba(239,68,68,0.25)",
    text: "#e2e8f0",
    subtext: "rgba(226,232,240,0.55)",
  },
  {
    card: "#141e27",
    header: "#06b6d4",
    border: "rgba(6,182,212,0.25)",
    text: "#e2e8f0",
    subtext: "rgba(226,232,240,0.55)",
  },
];

// ── Temp ID generation ────────────────────────────────────────────
let layoutCounter = 0;
function genTempId(): string {
  return `arch_${Date.now()}_${layoutCounter++}`;
}

// ── Measure a single layer's height given available width ────
function measureLayerH(layer: ArchitectureLayer, availW?: number): number {
  let maxCols = MAX_COMPONENTS_PER_ROW;
  if (availW != null) {
    const fittable = Math.max(
      1,
      Math.floor((availW - LAYER_PAD_X * 2 + COMPONENT_GAP) / (COMPONENT_W + COMPONENT_GAP))
    );
    maxCols = Math.max(fittable, MAX_COMPONENTS_PER_ROW);
  }
  const cols = Math.min(layer.components.length, maxCols);
  const rows = Math.max(1, Math.ceil(layer.components.length / cols));
  return LAYER_PAD_TOP + rows * COMPONENT_H + (rows - 1) * COMPONENT_GAP + LAYER_PAD_BOTTOM;
}

// ── Compute width needed for a layer given a column count ────
function layerContentWidth(cols: number): number {
  return LAYER_PAD_X * 2 + cols * COMPONENT_W + (cols - 1) * COMPONENT_GAP;
}

/**
 * Convert an ArchitectureAnalysis into positioned AIOperation[].
 *
 * Apple-inspired design: dark backdrop, rounded cards with depth,
 * colored header bands, generous spacing, label pills on connectors.
 */
export function layoutArchitecture(
  arch: ArchitectureAnalysis,
  baseX: number,
  baseY: number
): AIOperation[] {
  const componentTempIds = new Map<string, string>();
  const componentPositions = new Map<string, { x: number; y: number; w: number; h: number }>();

  const sortedLayers = [...arch.layers].sort((a, b) => a.tier - b.tier);

  // ── Group layers by tier for side-by-side layout ──────────────
  const tierGroups: ArchitectureLayer[][] = [];
  let currentTier = -1;
  for (const layer of sortedLayers) {
    if (layer.tier !== currentTier) {
      tierGroups.push([layer]);
      currentTier = layer.tier;
    } else {
      tierGroups[tierGroups.length - 1].push(layer);
    }
  }

  // ── Calculate uniform diagram width ───────────────────────────
  // Key rule: side-by-side layers must NEVER force components to wrap to a second row.
  // Each layer needs at least enough width to fit ALL its components in one row.
  let maxRowWidth = 0;
  for (const group of tierGroups) {
    if (group.length === 1) {
      const cols = Math.min(group[0].components.length, MAX_COMPONENTS_PER_ROW);
      maxRowWidth = Math.max(maxRowWidth, layerContentWidth(cols));
    } else {
      // Side-by-side: sum of each layer's minimum width + gaps between layers
      let groupWidth = (group.length - 1) * TIER_GROUP_GAP;
      for (const layer of group) {
        // Each layer must fit ALL its components in a single row (no wrapping)
        const cols = layer.components.length;
        groupWidth += layerContentWidth(cols);
      }
      maxRowWidth = Math.max(maxRowWidth, groupWidth);
    }
  }
  const uniformLayerW = Math.max(maxRowWidth, 560);

  // ── PASS 1: Measure total diagram height ──────────────────────
  let measureY = 0;

  // Title row (title + tech icons share same line)
  measureY += 40;

  // Description
  if (arch.description) measureY += 28;

  // Summary — estimate lines needed (approx 90 chars per line at width 700, fontSize 12)
  if (arch.summary) {
    const summaryLineW = uniformLayerW;
    const estCharsPerLine = Math.floor(summaryLineW / 6.5);
    const summaryLines = Math.max(1, Math.ceil(arch.summary.length / estCharsPerLine));
    measureY += summaryLines * 16 + 8;
  }

  measureY += TITLE_GAP;

  // Layers
  for (const group of tierGroups) {
    if (group.length === 1) {
      measureY += measureLayerH(group[0], uniformLayerW) + LAYER_GAP;
    } else {
      // Each layer gets width proportional to its component count
      const availableW = uniformLayerW - (group.length - 1) * TIER_GROUP_GAP;
      const totalCols = group.reduce((sum, l) => sum + l.components.length, 0);
      const maxH = Math.max(
        ...group.map((l) => {
          const w = Math.floor(availableW * (l.components.length / totalCols));
          return measureLayerH(l, w);
        })
      );
      measureY += maxH + LAYER_GAP;
    }
  }

  const totalDiagramH = measureY + BACKDROP_PAD;
  const totalDiagramW = uniformLayerW + BACKDROP_PAD * 2;

  // ── PASS 2: Emit shapes ───────────────────────────────────────
  const ops: AIOperation[] = [];

  const diagramX = baseX + BACKDROP_PAD;
  let contentY = baseY + BACKDROP_PAD;

  // ── Dark backdrop ─────────────────────────────────────────────
  ops.push({
    type: "createShape",
    tempId: genTempId(),
    shapeType: "rectangle",
    x: baseX,
    y: baseY,
    w: totalDiagramW,
    h: totalDiagramH,
    fill: "#0a0a0f",
    cornerRadius: BACKDROP_CORNER_R,
  });

  // ── Title row (title left, tech icons right) ─────────────────
  const hasIcons = arch.techStackIcons && arch.techStackIcons.length > 0;
  const iconsTotalW = hasIcons
    ? arch.techStackIcons!.length * (TECH_ICON_SIZE + TECH_ICON_GAP) - TECH_ICON_GAP
    : 0;
  const titleTextW = hasIcons ? uniformLayerW - iconsTotalW - 24 : uniformLayerW;

  ops.push({
    type: "createText",
    tempId: genTempId(),
    x: diagramX,
    y: contentY,
    text: arch.title,
    fontSize: 32,
    fontStyle: "bold",
    fill: "#f1f5f9",
    width: titleTextW,
  });

  // Tech icons aligned right on the same row as title
  if (hasIcons) {
    const iconsX = diagramX + uniformLayerW - iconsTotalW;
    const iconsY = contentY + 6; // vertically center with title text
    for (let i = 0; i < arch.techStackIcons!.length; i++) {
      ops.push({
        type: "createImage",
        tempId: genTempId(),
        x: iconsX + i * (TECH_ICON_SIZE + TECH_ICON_GAP),
        y: iconsY,
        w: TECH_ICON_SIZE,
        h: TECH_ICON_SIZE,
        src: `https://cdn.simpleicons.org/${arch.techStackIcons![i]}/ffffff`,
      });
    }
  }
  contentY += 40;

  // ── Description ───────────────────────────────────────────────
  if (arch.description) {
    ops.push({
      type: "createText",
      tempId: genTempId(),
      x: diagramX,
      y: contentY,
      text: arch.description,
      fontSize: 15,
      fill: "#94a3b8",
      width: uniformLayerW,
    });
    contentY += 28;
  }

  // ── Summary (full text, multi-line) ───────────────────────────
  if (arch.summary) {
    const summaryW = uniformLayerW;
    ops.push({
      type: "createText",
      tempId: genTempId(),
      x: diagramX,
      y: contentY,
      text: arch.summary,
      fontSize: 12,
      fill: "#64748b",
      width: summaryW,
    });
    const estCharsPerLine = Math.floor(summaryW / 6.5);
    const summaryLines = Math.max(1, Math.ceil(arch.summary.length / estCharsPerLine));
    contentY += summaryLines * 16 + 8;
  }

  contentY += TITLE_GAP;

  // ── Tier Groups (layers) ──────────────────────────────────────
  for (const group of tierGroups) {
    if (group.length === 1) {
      // Single layer at this tier: full width
      contentY += emitLayer(
        ops,
        group[0],
        diagramX,
        contentY,
        uniformLayerW,
        componentTempIds,
        componentPositions
      );
      contentY += LAYER_GAP;
    } else {
      // Multiple layers at same tier: side by side, width proportional to component count
      const availableW = uniformLayerW - (group.length - 1) * TIER_GROUP_GAP;
      const totalCols = group.reduce((sum, l) => sum + l.components.length, 0);

      let maxH = 0;
      let curX = diagramX;
      for (let g = 0; g < group.length; g++) {
        // Each layer gets width proportional to its component count (never wraps)
        const layerCols = group[g].components.length;
        const perLayerW = Math.floor(availableW * (layerCols / totalCols));
        const h = emitLayer(
          ops,
          group[g],
          curX,
          contentY,
          perLayerW,
          componentTempIds,
          componentPositions
        );
        maxH = Math.max(maxH, h);
        curX += perLayerW + TIER_GROUP_GAP;
      }
      contentY += maxH + LAYER_GAP;
    }
  }

  // ── Connectors ────────────────────────────────────────────────
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
      stroke: "rgba(148,163,184,0.45)",
      strokeWidth: 1.5,
    });

    // Label pill — centered on midpoint, opaque background covers the line
    if (conn.label) {
      const fromPos = componentPositions.get(conn.from);
      const toPos = componentPositions.get(conn.to);
      if (fromPos && toPos) {
        const fcx = fromPos.x + fromPos.w / 2;
        const fcy = fromPos.y + fromPos.h / 2;
        const tcx = toPos.x + toPos.w / 2;
        const tcy = toPos.y + toPos.h / 2;
        const midX = (fcx + tcx) / 2;
        const midY = (fcy + tcy) / 2;

        const labelW = Math.max(conn.label.length * 6 + 20, 60);
        const labelH = 20;

        // Opaque pill background (fully covers the connector line underneath)
        ops.push({
          type: "createShape",
          tempId: genTempId(),
          shapeType: "rectangle",
          x: midX - labelW / 2,
          y: midY - labelH / 2,
          w: labelW,
          h: labelH,
          fill: "#0f0f17",
          cornerRadius: 10,
          stroke: "rgba(148,163,184,0.2)",
          strokeWidth: 1,
        });

        // Label text — centered in pill
        ops.push({
          type: "createText",
          tempId: genTempId(),
          x: midX - labelW / 2,
          y: midY - 5,
          text: conn.label,
          fontSize: 10,
          fill: "#cbd5e1",
          width: labelW,
          align: "center",
        });
      }
    }
  }

  return ops;
}

// ── Emit a single layer and return its height ───────────────────
function emitLayer(
  ops: AIOperation[],
  layer: ArchitectureLayer,
  layerX: number,
  layerY: number,
  layerW: number,
  componentTempIds: Map<string, string>,
  componentPositions: Map<string, { x: number; y: number; w: number; h: number }>
): number {
  const tierIdx = Math.min(layer.tier, TIER_PALETTES.length - 1);
  const palette = TIER_PALETTES[tierIdx];
  const numComponents = layer.components.length;
  // How many components actually fit in one row given the layer width?
  const maxFittable = Math.max(
    1,
    Math.floor((layerW - LAYER_PAD_X * 2 + COMPONENT_GAP) / (COMPONENT_W + COMPONENT_GAP))
  );
  const cols = Math.min(numComponents, Math.max(maxFittable, MAX_COMPONENTS_PER_ROW));
  const rows = Math.ceil(numComponents / cols);
  const layerH = LAYER_PAD_TOP + rows * COMPONENT_H + (rows - 1) * COMPONENT_GAP + LAYER_PAD_BOTTOM;

  // ── Layer background card ───────────────────────────────────
  ops.push({
    type: "createShape",
    tempId: genTempId(),
    shapeType: "rectangle",
    x: layerX,
    y: layerY,
    w: layerW,
    h: layerH,
    fill: "rgba(255,255,255,0.03)",
    cornerRadius: HEADER_CORNER_R,
    stroke: "rgba(255,255,255,0.06)",
    strokeWidth: 1,
  });

  // ── Colored header band ─────────────────────────────────────
  ops.push({
    type: "createShape",
    tempId: genTempId(),
    shapeType: "rectangle",
    x: layerX,
    y: layerY,
    w: layerW,
    h: HEADER_BAND_H,
    fill: palette.header,
    cornerRadius: HEADER_CORNER_R,
  });
  // Bottom half of header (square off the bottom corners)
  ops.push({
    type: "createShape",
    tempId: genTempId(),
    shapeType: "rectangle",
    x: layerX,
    y: layerY + HEADER_BAND_H / 2,
    w: layerW,
    h: HEADER_BAND_H / 2,
    fill: palette.header,
  });

  // ── Layer title ─────────────────────────────────────────────
  ops.push({
    type: "createText",
    tempId: genTempId(),
    x: layerX + 16,
    y: layerY + 10,
    text: layer.name,
    fontSize: 14,
    fontStyle: "bold",
    fill: "#ffffff",
    width: layerW - 32,
  });

  // ── Per-layer icons in header (right side) ──────────────────
  const layerIcons = layer.components
    .map((c) => c.iconSlug)
    .filter((slug): slug is string => !!slug);
  const uniqueIcons = [...new Set(layerIcons)];
  if (uniqueIcons.length > 0) {
    const iconRowW = uniqueIcons.length * (TECH_ICON_SIZE + TECH_ICON_GAP) - TECH_ICON_GAP;
    const iconStartX = layerX + layerW - iconRowW - 16;
    const iconY = layerY + (HEADER_BAND_H - TECH_ICON_SIZE) / 2;

    for (let i = 0; i < uniqueIcons.length; i++) {
      ops.push({
        type: "createImage",
        tempId: genTempId(),
        x: iconStartX + i * (TECH_ICON_SIZE + TECH_ICON_GAP),
        y: iconY,
        w: TECH_ICON_SIZE,
        h: TECH_ICON_SIZE,
        src: `https://cdn.simpleicons.org/${uniqueIcons[i]}/ffffff`,
      });
    }
  }

  // ── Component cards ─────────────────────────────────────────
  const actualCols = Math.min(numComponents, cols);
  const contentW = actualCols * COMPONENT_W + (actualCols - 1) * COMPONENT_GAP;
  const startX = layerX + (layerW - contentW) / 2;

  for (let i = 0; i < numComponents; i++) {
    const comp = layer.components[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = startX + col * (COMPONENT_W + COMPONENT_GAP);
    const cy = layerY + LAYER_PAD_TOP + row * (COMPONENT_H + COMPONENT_GAP);

    componentPositions.set(comp.id, { x: cx, y: cy, w: COMPONENT_W, h: COMPONENT_H });

    // Drop shadow
    ops.push({
      type: "createShape",
      tempId: genTempId(),
      shapeType: "rectangle",
      x: cx + SHADOW_DX,
      y: cy + SHADOW_DY,
      w: COMPONENT_W,
      h: COMPONENT_H,
      fill: "rgba(0,0,0,0.4)",
      cornerRadius: COMPONENT_CORNER_R,
    });

    // Card body
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
      fill: palette.card,
      cornerRadius: COMPONENT_CORNER_R,
      stroke: palette.border,
      strokeWidth: 1,
    });

    // Component name (always starts at same position — no icon gap)
    ops.push({
      type: "createText",
      tempId: genTempId(),
      x: cx + 14,
      y: cy + 16,
      text: comp.name,
      fontSize: 13,
      fontStyle: "bold",
      fill: palette.text,
      width: COMPONENT_W - 28,
    });

    // Description / tech stack
    const subText = comp.techStack || comp.description;
    if (subText) {
      ops.push({
        type: "createText",
        tempId: genTempId(),
        x: cx + 14,
        y: cy + 38,
        text: subText,
        fontSize: 11,
        fill: palette.subtext,
        width: COMPONENT_W - 28,
      });
    }

    // Tier accent line at bottom of card
    ops.push({
      type: "createShape",
      tempId: genTempId(),
      shapeType: "rectangle",
      x: cx + 14,
      y: cy + COMPONENT_H - 14,
      w: 32,
      h: 3,
      fill: palette.header,
      cornerRadius: 2,
    });
  }

  return layerH;
}
