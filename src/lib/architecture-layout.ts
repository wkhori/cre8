import type {
  ArchitectureAnalysis,
  ArchitectureLayer,
  ArchitectureConnection,
} from "./architecture-types";
import type { AIOperation } from "./ai-tools";

// ── Layout constants ──────────────────────────────────────────────
const COMPONENT_W = 180;
const COMPONENT_H = 52;
const COMPONENT_GAP = 16;
const COMPONENT_CORNER_R = 10;
const LAYER_PAD_X = 24;
const LAYER_PAD_TOP = 56; // more room for header band + subtitle
const LAYER_PAD_BOTTOM = 18;
const LAYER_GAP = 28;
const SECTION_GAP = 24;
const SECTION_PAD = 14;
const SECTION_HEADER_H = 24;
const TECH_ICON_SIZE = 22;
const TECH_ICON_GAP = 10;
const MAX_COMPONENTS_PER_ROW = 6;
const HEADER_BAND_H = 32;
const HEADER_CORNER_R = 10;
const SHADOW_DX = 3;
const SHADOW_DY = 3;
const BACKDROP_PAD = 36;
const BACKDROP_CORNER_R = 20;
const COLUMN_GAP = 24;

// ── Dynamic palette generation ────────────────────────────────────
interface TierPalette {
  card: string;
  header: string;
  border: string;
  text: string;
  subtext: string;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hslToRgba(h: number, s: number, l: number, a: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const sa = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - sa * Math.max(Math.min(k - 3, 9 - k, 1), -1)));
  };
  return `rgba(${f(0)},${f(8)},${f(4)},${a})`;
}

type ColorTheme = "warm" | "cool" | "earth" | "neon" | "ocean" | "mono";

const THEME_RANGES: Record<ColorTheme, { min: number; max: number; sat: number }> = {
  warm: { min: 0, max: 60, sat: 75 },
  cool: { min: 200, max: 260, sat: 70 },
  earth: { min: 20, max: 50, sat: 55 },
  neon: { min: 270, max: 340, sat: 85 },
  ocean: { min: 180, max: 220, sat: 65 },
  mono: { min: 0, max: 0, sat: 0 },
};

function generatePalettes(
  theme: ColorTheme | undefined,
  title: string,
  count: number
): TierPalette[] {
  const t = theme ?? "cool";
  const range = THEME_RANGES[t];
  const seed = hashString(title);

  if (t === "mono" || count === 0) {
    return Array.from({ length: Math.max(count, 1) }, (_, i) => {
      const lightness = 45 + ((i * 15) % 30);
      return {
        card: hslToHex(0, 0, 12 + ((i * 2) % 6)),
        header: hslToHex(0, 0, lightness),
        border: hslToRgba(0, 0, lightness, 0.25),
        text: "#e2e8f0",
        subtext: "rgba(226,232,240,0.55)",
      };
    });
  }

  const baseHue = range.min + (seed % Math.max(range.max - range.min, 1));
  // Spread hues across a wider arc for visual variety
  const spread = Math.min(300, 60 + count * 40);

  return Array.from({ length: count }, (_, i) => {
    const hue = baseHue + (i * spread) / count;
    const sat = range.sat + ((seed >> (i + 1)) % 15) - 7; // slight jitter
    return {
      card: hslToHex(hue, sat * 0.3, 12),
      header: hslToHex(hue, sat, 55),
      border: hslToRgba(hue, sat, 55, 0.25),
      text: "#e2e8f0",
      subtext: "rgba(226,232,240,0.55)",
    };
  });
}

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

// ── Reconcile icons: ensure techStackIcons is superset of layer icons ──
function reconcileIcons(arch: ArchitectureAnalysis): string[] {
  const allLayerIcons = new Set<string>();
  for (const layer of arch.layers) {
    for (const comp of layer.components) {
      if (comp.iconSlug) allLayerIcons.add(comp.iconSlug);
    }
  }
  const existing = arch.techStackIcons ?? [];
  const existingSet = new Set(existing);
  const extras = [...allLayerIcons].filter((slug) => !existingSet.has(slug));
  return [...existing, ...extras].slice(0, 10);
}

// ── Section measurement ──────────────────────────────────────────
interface SectionInfo {
  name: string;
  layers: ArchitectureLayer[];
  componentCount: number;
  maxLayerCols: number;
  measuredH: number;
  minW: number;
}

function measureSection(layers: ArchitectureLayer[], availW?: number): number {
  let h = SECTION_HEADER_H + SECTION_PAD;
  for (let i = 0; i < layers.length; i++) {
    h += measureLayerH(layers[i], availW);
    if (i < layers.length - 1) h += LAYER_GAP;
  }
  h += SECTION_PAD;
  return h;
}

function buildSectionInfos(sectionMap: Map<string, ArchitectureLayer[]>): SectionInfo[] {
  const infos: SectionInfo[] = [];
  for (const [name, layers] of sectionMap) {
    const sorted = [...layers].sort((a, b) => a.tier - b.tier);
    const componentCount = sorted.reduce((s, l) => s + l.components.length, 0);
    const maxLayerCols = Math.max(...sorted.map((l) => l.components.length), 1);
    const minW = layerContentWidth(maxLayerCols);
    const measuredH = measureSection(sorted);
    infos.push({ name, layers: sorted, componentCount, maxLayerCols, measuredH, minW });
  }
  return infos;
}

/**
 * Convert an ArchitectureAnalysis into positioned AIOperation[].
 *
 * Apple-inspired design: dark backdrop, rounded cards with depth,
 * colored header bands, generous spacing, label pills on connectors.
 * Now with dynamic palettes, section-based bento layout, and smart connectors.
 */
export function layoutArchitecture(
  arch: ArchitectureAnalysis,
  baseX: number,
  baseY: number
): AIOperation[] {
  const componentTempIds = new Map<string, string>();
  const componentPositions = new Map<string, { x: number; y: number; w: number; h: number }>();
  const componentTierMap = new Map<string, number>();
  const componentSectionMap = new Map<string, string>();

  // ── Reconcile icons ─────────────────────────────────────────────
  const techIcons = reconcileIcons(arch);

  // ── Generate dynamic palettes ───────────────────────────────────
  const palettes = generatePalettes(arch.colorTheme, arch.title, arch.layers.length);

  // ── Group layers by section ─────────────────────────────────────
  const sectionMap = new Map<string, ArchitectureLayer[]>();
  const sectionOrder: string[] = [];

  for (const layer of [...arch.layers].sort((a, b) => a.tier - b.tier)) {
    const sec = layer.section ?? "General";
    if (!sectionMap.has(sec)) {
      sectionMap.set(sec, []);
      sectionOrder.push(sec);
    }
    sectionMap.get(sec)!.push(layer);
    // Map components to their tier/section for connector routing
    for (const comp of layer.components) {
      componentTierMap.set(comp.id, layer.tier);
      componentSectionMap.set(comp.id, sec);
    }
  }

  const sections = buildSectionInfos(sectionMap);
  // Maintain the order sections appear (by first layer's tier)
  sections.sort((a, b) => sectionOrder.indexOf(a.name) - sectionOrder.indexOf(b.name));

  // Assign palette index to each layer (global order across all sections)
  const layerPaletteMap = new Map<ArchitectureLayer, TierPalette>();
  let paletteIdx = 0;
  for (const sec of sections) {
    for (const layer of sec.layers) {
      layerPaletteMap.set(layer, palettes[paletteIdx % palettes.length]);
      paletteIdx++;
    }
  }

  // ── Choose layout strategy ──────────────────────────────────────
  const layoutHint = arch.layoutHint ?? "bento";
  const totalComponents = arch.layers.reduce((s, l) => s + l.components.length, 0);

  // Calculate section grid placement
  interface PlacedSection extends SectionInfo {
    col: number;
    x: number;
    y: number;
    w: number;
    h: number;
  }

  let placedSections: PlacedSection[];
  let gridW: number;
  let gridH: number;

  // Minimum column width: enough for 3 components side by side
  const MIN_COL_W = layerContentWidth(3);

  if (sections.length <= 1 || layoutHint === "vertical") {
    // ── Vertical: single column ──────────────────────────────────
    const maxW = Math.max(MIN_COL_W, ...sections.map((s) => s.minW));
    let curY = 0;
    placedSections = sections.map((sec) => {
      const h = measureSection(sec.layers, maxW);
      const placed: PlacedSection = {
        ...sec,
        col: 0,
        x: 0,
        y: curY,
        w: maxW,
        h,
      };
      curY += h + SECTION_GAP;
      return placed;
    });
    gridW = maxW;
    gridH = curY - (sections.length > 0 ? SECTION_GAP : 0);
  } else if (layoutHint === "horizontal") {
    // ── Horizontal: side by side columns ─────────────────────────
    const leftSections = sections.filter((_, i) => i % 2 === 0);
    const rightSections = sections.filter((_, i) => i % 2 === 1);

    const leftMaxCols = Math.max(...leftSections.map((s) => s.maxLayerCols), 2);
    const rightMaxCols = Math.max(...rightSections.map((s) => s.maxLayerCols), 2);
    const totalCols = leftMaxCols + rightMaxCols;
    const rawTotal = layerContentWidth(leftMaxCols) + layerContentWidth(rightMaxCols) + COLUMN_GAP;
    const total = rawTotal;
    const leftW = Math.max(Math.floor((total - COLUMN_GAP) * (leftMaxCols / totalCols)), MIN_COL_W);
    const rightW = Math.max(total - COLUMN_GAP - leftW, MIN_COL_W);

    placedSections = [];
    let leftY = 0;
    for (const sec of leftSections) {
      const h = measureSection(sec.layers, leftW);
      placedSections.push({ ...sec, col: 0, x: 0, y: leftY, w: leftW, h });
      leftY += h + SECTION_GAP;
    }
    let rightY = 0;
    for (const sec of rightSections) {
      const h = measureSection(sec.layers, rightW);
      placedSections.push({ ...sec, col: 1, x: leftW + COLUMN_GAP, y: rightY, w: rightW, h });
      rightY += h + SECTION_GAP;
    }
    gridW = leftW + COLUMN_GAP + rightW;
    gridH = Math.max(
      leftY - (leftSections.length > 0 ? SECTION_GAP : 0),
      rightY - (rightSections.length > 0 ? SECTION_GAP : 0)
    );
  } else {
    // ── Bento: greedy shortest-column-first ──────────────────────
    // Check if one section dominates (>55% of components)
    const dominant = sections.find(
      (s) => s.componentCount > totalComponents * 0.55 && sections.length > 2
    );

    if (dominant) {
      // Dominant section gets full width on top, rest side-by-side below
      const rest = sections.filter((s) => s !== dominant);
      const restMaxCols = Math.max(...rest.map((s) => s.maxLayerCols), 2);
      const domMinW = dominant.minW;
      const restColW = Math.max(layerContentWidth(restMaxCols), MIN_COL_W);
      const restTotalW = rest.length >= 2 ? restColW * 2 + COLUMN_GAP : restColW;
      const fullW = Math.max(domMinW, restTotalW);

      const domH = measureSection(dominant.layers, fullW);
      placedSections = [{ ...dominant, col: 0, x: 0, y: 0, w: fullW, h: domH }];

      let belowY = domH + SECTION_GAP;
      if (rest.length === 1) {
        const h = measureSection(rest[0].layers, fullW);
        placedSections.push({ ...rest[0], col: 0, x: 0, y: belowY, w: fullW, h });
        belowY += h;
      } else {
        // Split rest into 2 columns
        const colW = Math.floor((fullW - COLUMN_GAP) / 2);
        let leftY = belowY;
        let rightY = belowY;
        for (let i = 0; i < rest.length; i++) {
          const sec = rest[i];
          const h = measureSection(sec.layers, colW);
          if (leftY <= rightY) {
            placedSections.push({ ...sec, col: 0, x: 0, y: leftY, w: colW, h });
            leftY += h + SECTION_GAP;
          } else {
            placedSections.push({ ...sec, col: 1, x: colW + COLUMN_GAP, y: rightY, w: colW, h });
            rightY += h + SECTION_GAP;
          }
        }
        belowY = Math.max(leftY, rightY) - SECTION_GAP;
      }
      gridW = fullW;
      gridH = belowY;
    } else {
      // Standard 2-column bento — greedy shortest-column-first
      const sorted = [...sections].sort((a, b) => b.componentCount - a.componentCount);

      const leftIdxs: number[] = [];
      const rightIdxs: number[] = [];
      let leftH = 0;
      let rightH = 0;
      for (let i = 0; i < sorted.length; i++) {
        if (leftH <= rightH) {
          leftIdxs.push(i);
          leftH += sorted[i].measuredH + SECTION_GAP;
        } else {
          rightIdxs.push(i);
          rightH += sorted[i].measuredH + SECTION_GAP;
        }
      }

      const leftMaxCols = Math.max(...leftIdxs.map((i) => sorted[i].maxLayerCols), 2);
      const rightMaxCols =
        rightIdxs.length > 0 ? Math.max(...rightIdxs.map((i) => sorted[i].maxLayerCols), 2) : 2;
      const leftW = Math.max(layerContentWidth(leftMaxCols), MIN_COL_W);
      const rightW = Math.max(layerContentWidth(rightMaxCols), MIN_COL_W);

      placedSections = [];
      let curLeftY = 0;
      for (const idx of leftIdxs) {
        const sec = sorted[idx];
        const h = measureSection(sec.layers, leftW);
        placedSections.push({ ...sec, col: 0, x: 0, y: curLeftY, w: leftW, h });
        curLeftY += h + SECTION_GAP;
      }
      let curRightY = 0;
      for (const idx of rightIdxs) {
        const sec = sorted[idx];
        const h = measureSection(sec.layers, rightW);
        placedSections.push({
          ...sec,
          col: 1,
          x: leftW + COLUMN_GAP,
          y: curRightY,
          w: rightW,
          h,
        });
        curRightY += h + SECTION_GAP;
      }
      gridW = leftW + COLUMN_GAP + rightW;
      gridH = Math.max(
        curLeftY - (leftIdxs.length > 0 ? SECTION_GAP : 0),
        curRightY - (rightIdxs.length > 0 ? SECTION_GAP : 0)
      );
    }
  }

  // ── Measure header area ─────────────────────────────────────────
  let headerH = 40; // title
  if (arch.description) headerH += 24;
  headerH += 16; // separator + gap

  const totalDiagramW = gridW + BACKDROP_PAD * 2;
  const totalDiagramH = headerH + gridH + BACKDROP_PAD * 2;

  // ── Emit shapes ─────────────────────────────────────────────────
  const ops: AIOperation[] = [];
  const diagramX = baseX + BACKDROP_PAD;
  let contentY = baseY + BACKDROP_PAD;

  // ── Dark backdrop ───────────────────────────────────────────────
  ops.push({
    type: "createShape",
    tempId: genTempId(),
    shapeType: "rectangle",
    x: baseX,
    y: baseY,
    w: totalDiagramW,
    h: totalDiagramH,
    fill: "#08080d",
    cornerRadius: BACKDROP_CORNER_R,
  });

  // Subtle inner glow (lighter rect inset by 1px, very faint)
  ops.push({
    type: "createShape",
    tempId: genTempId(),
    shapeType: "rectangle",
    x: baseX + 1,
    y: baseY + 1,
    w: totalDiagramW - 2,
    h: totalDiagramH - 2,
    fill: "#0a0a12",
    cornerRadius: BACKDROP_CORNER_R - 1,
    stroke: "rgba(255,255,255,0.04)",
    strokeWidth: 1,
  });

  // ── Title row (title left, tech icons right) ───────────────────
  const hasIcons = techIcons.length > 0;
  const iconsTotalW = hasIcons
    ? techIcons.length * (TECH_ICON_SIZE + TECH_ICON_GAP) - TECH_ICON_GAP
    : 0;
  const titleTextW = hasIcons ? gridW - iconsTotalW - 24 : gridW;

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

  if (hasIcons) {
    const iconsX = diagramX + gridW - iconsTotalW;
    const iconsY = contentY + 6;
    for (let i = 0; i < techIcons.length; i++) {
      ops.push({
        type: "createImage",
        tempId: genTempId(),
        x: iconsX + i * (TECH_ICON_SIZE + TECH_ICON_GAP),
        y: iconsY,
        w: TECH_ICON_SIZE,
        h: TECH_ICON_SIZE,
        src: `https://cdn.simpleicons.org/${techIcons[i]}/ffffff`,
      });
    }
  }
  contentY += 40;

  // ── Description (one-liner only) ───────────────────────────────
  if (arch.description) {
    ops.push({
      type: "createText",
      tempId: genTempId(),
      x: diagramX,
      y: contentY,
      text: arch.description,
      fontSize: 13,
      fill: "#94a3b8",
      width: gridW,
    });
    contentY += 24;
  }

  // ── Separator line ────────────────────────────────────────────
  ops.push({
    type: "createShape",
    tempId: genTempId(),
    shapeType: "rectangle",
    x: diagramX,
    y: contentY,
    w: gridW,
    h: 1,
    fill: "rgba(255,255,255,0.08)",
  });
  contentY += 16;

  // ── Render sections ─────────────────────────────────────────────
  const gridBaseY = contentY;

  for (const sec of placedSections) {
    const secX = diagramX + sec.x;
    const secY = gridBaseY + sec.y;
    const secW = sec.w;
    const secH = sec.h;

    // Section background — tinted with first layer's palette
    const secPalette = layerPaletteMap.get(sec.layers[0]);
    const secTint = secPalette
      ? secPalette.border.replace(/[\d.]+\)$/, "0.06)")
      : "rgba(255,255,255,0.03)";
    const secStroke = secPalette
      ? secPalette.border.replace(/[\d.]+\)$/, "0.12)")
      : "rgba(255,255,255,0.06)";
    ops.push({
      type: "createShape",
      tempId: genTempId(),
      shapeType: "rectangle",
      x: secX,
      y: secY,
      w: secW,
      h: secH,
      fill: secTint,
      cornerRadius: 16,
      stroke: secStroke,
      strokeWidth: 1,
    });

    // Section icons (right side) — all unique tech from components in this section
    const sectionIcons = new Set<string>();
    for (const layer of sec.layers) {
      for (const comp of layer.components) {
        if (comp.iconSlug) sectionIcons.add(comp.iconSlug);
      }
    }
    const sectionIconList = [...sectionIcons];
    if (sectionIconList.length > 0) {
      const iconSize = 14;
      const iconGap = 5;
      const iconRowW = sectionIconList.length * (iconSize + iconGap) - iconGap;
      const iconStartX = secX + secW - iconRowW - 14;
      const iconY = secY + (SECTION_HEADER_H - iconSize) / 2;
      for (let i = 0; i < sectionIconList.length; i++) {
        ops.push({
          type: "createImage",
          tempId: genTempId(),
          x: iconStartX + i * (iconSize + iconGap),
          y: iconY,
          w: iconSize,
          h: iconSize,
          src: `https://cdn.simpleicons.org/${sectionIconList[i]}/ffffff`,
        });
      }
    }

    // Section label
    ops.push({
      type: "createText",
      tempId: genTempId(),
      x: secX + 14,
      y: secY + 6,
      text: sec.name.toUpperCase(),
      fontSize: 10,
      fontStyle: "bold",
      fill: "rgba(255,255,255,0.35)",
      width: secW - 28,
    });

    // Render layers within this section
    let layerY = secY + SECTION_HEADER_H + SECTION_PAD;
    const layerAvailW = secW - SECTION_PAD * 2;

    for (const layer of sec.layers) {
      const palette = layerPaletteMap.get(layer)!;
      const layerX = secX + SECTION_PAD;
      const h = emitLayer(
        ops,
        layer,
        layerX,
        layerY,
        layerAvailW,
        palette,
        componentTempIds,
        componentPositions
      );
      layerY += h + LAYER_GAP;
    }
  }

  // ── Smart connectors ────────────────────────────────────────────
  emitConnectors(
    ops,
    arch.connections,
    componentTempIds,
    componentPositions,
    componentTierMap,
    componentSectionMap
  );

  return ops;
}

// ── Smart connector emission ──────────────────────────────────────
function emitConnectors(
  ops: AIOperation[],
  connections: ArchitectureConnection[],
  componentTempIds: Map<string, string>,
  componentPositions: Map<string, { x: number; y: number; w: number; h: number }>,
  componentTierMap: Map<string, number>,
  componentSectionMap: Map<string, string>
) {
  for (const conn of connections) {
    const fromTempId = componentTempIds.get(conn.from);
    const toTempId = componentTempIds.get(conn.to);
    if (!fromTempId || !toTempId) continue;

    const importance = conn.importance ?? "secondary";
    const fromTier = componentTierMap.get(conn.from) ?? 0;
    const toTier = componentTierMap.get(conn.to) ?? 0;
    const fromSection = componentSectionMap.get(conn.from) ?? "";
    const toSection = componentSectionMap.get(conn.to) ?? "";
    const tierDiff = Math.abs(fromTier - toTier);
    const sameSection = fromSection === toSection;

    // Choose routing: straight for same-tier neighbors, elbowed for everything else
    let routingMode: "straight" | "curved" | "elbowed";
    if (tierDiff === 0 && sameSection) {
      routingMode = "straight";
    } else {
      routingMode = "elbowed";
    }

    // Vary stroke by importance
    let strokeWidth: number;
    let stroke: string;
    let lineStyle: "solid" | "dashed" | "dotted";
    let showLabel: boolean;

    switch (importance) {
      case "primary":
        strokeWidth = 2;
        stroke = "rgba(148,163,184,0.7)";
        lineStyle = conn.lineStyle ?? "solid";
        showLabel = true;
        break;
      case "tertiary":
        strokeWidth = 1;
        stroke = "rgba(148,163,184,0.2)";
        lineStyle = conn.lineStyle ?? "dashed";
        showLabel = false;
        break;
      default: // secondary
        strokeWidth = 1.5;
        stroke = "rgba(148,163,184,0.4)";
        lineStyle = conn.lineStyle ?? "solid";
        showLabel = true;
        break;
    }

    ops.push({
      type: "createConnector",
      tempId: genTempId(),
      fromId: fromTempId,
      toId: toTempId,
      style: conn.style ?? "arrow",
      lineStyle,
      routingMode,
      stroke,
      strokeWidth,
    });

    // Label pill — offset away from component cards to avoid overlap
    if (showLabel && conn.label) {
      const fromPos = componentPositions.get(conn.from);
      const toPos = componentPositions.get(conn.to);
      if (fromPos && toPos) {
        const fcx = fromPos.x + fromPos.w / 2;
        const fcy = fromPos.y + fromPos.h / 2;
        const tcx = toPos.x + toPos.w / 2;
        const tcy = toPos.y + toPos.h / 2;
        let midX = (fcx + tcx) / 2;
        let midY = (fcy + tcy) / 2;

        const labelW = Math.max(conn.label.length * 6 + 20, 60);
        const labelH = 20;

        // Nudge the label away from any overlapping component card
        const labelRect = {
          x: midX - labelW / 2,
          y: midY - labelH / 2,
          w: labelW,
          h: labelH,
        };
        for (const [, pos] of componentPositions) {
          const pad = 6;
          if (
            labelRect.x < pos.x + pos.w + pad &&
            labelRect.x + labelRect.w > pos.x - pad &&
            labelRect.y < pos.y + pos.h + pad &&
            labelRect.y + labelRect.h > pos.y - pad
          ) {
            // Overlap detected — shift label perpendicular to connector direction
            const dx = tcx - fcx;
            const dy = tcy - fcy;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            // Perpendicular unit vector
            const px = -dy / len;
            const py = dx / len;
            // Shift 30px perpendicular (away from card center)
            const cardCx = pos.x + pos.w / 2;
            const cardCy = pos.y + pos.h / 2;
            const sign = (midX - cardCx) * px + (midY - cardCy) * py >= 0 ? 1 : -1;
            midX += px * 30 * sign;
            midY += py * 30 * sign;
            break; // one nudge is enough
          }
        }

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
}

// ── Emit a single layer and return its height ───────────────────
function emitLayer(
  ops: AIOperation[],
  layer: ArchitectureLayer,
  layerX: number,
  layerY: number,
  layerW: number,
  palette: TierPalette,
  componentTempIds: Map<string, string>,
  componentPositions: Map<string, { x: number; y: number; w: number; h: number }>
): number {
  const numComponents = layer.components.length;
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
    y: layerY + 8,
    text: layer.name,
    fontSize: 13,
    fontStyle: "bold",
    fill: "#ffffff",
    width: layerW - 32,
  });

  // ── Layer subtitle (description) ────────────────────────────
  if (layer.description) {
    ops.push({
      type: "createText",
      tempId: genTempId(),
      x: layerX + 16,
      y: layerY + HEADER_BAND_H + 4,
      text: layer.description,
      fontSize: 10,
      fill: "rgba(226,232,240,0.5)",
      width: layerW - 32,
    });
  }

  // ── Component cards (compact: name + tech label) ────────────
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
      fill: "rgba(0,0,0,0.35)",
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

    // Inline icon (if available) + component name
    const hasIcon = !!comp.iconSlug;
    const iconInlineSize = 14;
    const textLeft = hasIcon ? cx + 12 + iconInlineSize + 6 : cx + 12;
    const textW = hasIcon ? COMPONENT_W - 24 - iconInlineSize - 6 : COMPONENT_W - 24;

    if (hasIcon) {
      ops.push({
        type: "createImage",
        tempId: genTempId(),
        x: cx + 12,
        y: comp.techStack ? cy + 10 : cy + (COMPONENT_H - iconInlineSize) / 2,
        w: iconInlineSize,
        h: iconInlineSize,
        src: `https://cdn.simpleicons.org/${comp.iconSlug}/ffffff`,
      });
    }

    const nameY = comp.techStack ? cy + 10 : cy + (COMPONENT_H - 14) / 2;
    ops.push({
      type: "createText",
      tempId: genTempId(),
      x: textLeft,
      y: nameY,
      text: comp.name,
      fontSize: 12,
      fontStyle: "bold",
      fill: palette.text,
      width: textW,
    });

    // Tech stack as small muted label below name
    if (comp.techStack) {
      ops.push({
        type: "createText",
        tempId: genTempId(),
        x: textLeft,
        y: cy + 28,
        text: comp.techStack,
        fontSize: 9,
        fill: "rgba(226,232,240,0.4)",
        width: textW,
      });
    }
  }

  return layerH;
}
