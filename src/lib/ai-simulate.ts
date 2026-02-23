// ── AI tool call simulation + board state formatting ─────────────────
// Extracted from ai-command/route.ts to keep the route focused on HTTP handling.

import type { AIOperation } from "@/lib/ai-tools";

// ── Temp ID generation (server-side, for tracking across tool rounds) ──
let tempCounter = 0;
export function generateTempId(): string {
  return `temp_${Date.now()}_${tempCounter++}`;
}

// ── Board state formatting ──────────────────────────────────────────

function getShapeBounds(
  s: Record<string, unknown>
): { x: number; y: number; w: number; h: number } | null {
  const type = s.type as string;
  const x = s.x as number;
  const y = s.y as number;

  switch (type) {
    case "sticky":
    case "rect":
    case "frame":
    case "image":
      return { x, y, w: (s.w as number) || 260, h: (s.h as number) || 120 };
    case "text":
      return { x, y, w: (s.width as number) || 200, h: (s.fontSize as number) || 24 };
    case "circle": {
      const rx = (s.radiusX as number) || 50;
      const ry = (s.radiusY as number) || 50;
      return { x: x - rx, y: y - ry, w: rx * 2, h: ry * 2 };
    }
    case "connector":
    case "line":
      return null; // connectors/lines don't occupy meaningful space
    default:
      return { x, y, w: 100, h: 100 };
  }
}

// Compact summary: just count + bounds (used in initial user message)
export function formatBoardSummary(
  shapes: Record<string, unknown>[],
  viewportCenter?: { x: number; y: number }
): string {
  if (shapes.length === 0) return "The board is currently empty.";

  const bounds = shapes.map(getShapeBounds).filter((b): b is NonNullable<typeof b> => b !== null);
  if (bounds.length === 0) return `The board has ${shapes.length} objects (no spatial data).`;

  const minX = Math.round(Math.min(...bounds.map((b) => b.x)));
  const minY = Math.round(Math.min(...bounds.map((b) => b.y)));
  const maxX = Math.round(Math.max(...bounds.map((b) => b.x + b.w)));
  const maxY = Math.round(Math.max(...bounds.map((b) => b.y + b.h)));

  let summary = `The board has ${shapes.length} objects occupying the region (${minX}, ${minY}) to (${maxX}, ${maxY}).`;

  if (viewportCenter) {
    const vcx = viewportCenter.x;
    const vcy = viewportCenter.y;

    summary += ` Suggested open space starts at (${vcx}, ${vcy}) — this area is CLEAR of all existing objects. Place new content starting here.`;
  }

  return summary;
}

// Full details: every object listed (used for getBoardState tool response)
function formatBoardStateFull(shapes: Record<string, unknown>[]): string {
  if (shapes.length === 0) return "The board is currently empty.";

  const lines = shapes.map((s) => {
    const id = s.id as string;
    const type = s.type as string;
    const x = Math.round(s.x as number);
    const y = Math.round(s.y as number);
    const base = `- [${id}] ${type} top-left=(${x}, ${y})`;

    switch (type) {
      case "sticky":
        return `${base} text="${s.text}" color=${s.color} ${s.w}×${s.h}${s.fontFamily ? ` font=${s.fontFamily}` : ""}${s.fontStyle && s.fontStyle !== "normal" ? ` fontStyle=${s.fontStyle}` : ""}${s.textDecoration === "underline" ? " underline" : ""}`;
      case "text":
        return `${base} text="${s.text}"${s.fontFamily ? ` font=${s.fontFamily}` : ""}${s.fontStyle && s.fontStyle !== "normal" ? ` fontStyle=${s.fontStyle}` : ""}${s.textDecoration === "underline" ? " underline" : ""}`;
      case "frame":
        return `${base} title="${s.title}" ${s.w}×${s.h}`;
      case "rect":
        return `${base} ${s.w}×${s.h} fill=${s.fill}`;
      case "circle":
        return `${base} ${(s.radiusX as number) * 2}×${(s.radiusY as number) * 2} fill=${s.fill}`;
      case "connector":
        return `${base} ${s.fromId} → ${s.toId} style=${s.style} lineStyle=${s.lineStyle ?? "solid"} strokeWidth=${s.strokeWidth ?? 2}`;
      case "line":
        return `${base} stroke=${s.stroke}`;
      default:
        return base;
    }
  });

  return `The board has ${shapes.length} objects:\n${lines.join("\n")}`;
}

// ── Tool call simulation ───────────────────────────────────────────
// Returns AIOperation(s) + a simulated tool result string for Claude
export function simulateToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  boardState: Record<string, unknown>[],
  tempIdMap: Map<string, string>
): { operation: AIOperation | null; result: string; extraOps?: AIOperation[] } {
  switch (toolName) {
    case "createStickyNote": {
      const tempId = generateTempId();
      const op: AIOperation = {
        type: "createStickyNote",
        tempId,
        x: toolInput.x as number,
        y: toolInput.y as number,
        text: toolInput.text as string,
        color: toolInput.color as string | undefined,
        w: toolInput.width as number | undefined,
        h: toolInput.height as number | undefined,
        fontFamily: toolInput.fontFamily as string | undefined,
        fontStyle: toolInput.fontStyle as "normal" | "bold" | "italic" | "bold italic" | undefined,
        textDecoration: toolInput.textDecoration as "none" | "underline" | undefined,
      };
      tempIdMap.set(tempId, tempId);
      return {
        operation: op,
        result: JSON.stringify({ success: true, objectId: tempId }),
      };
    }

    case "createFrame": {
      const tempId = generateTempId();
      const op: AIOperation = {
        type: "createFrame",
        tempId,
        x: toolInput.x as number,
        y: toolInput.y as number,
        title: toolInput.title as string,
        w: toolInput.width as number | undefined,
        h: toolInput.height as number | undefined,
      };
      tempIdMap.set(tempId, tempId);
      return {
        operation: op,
        result: JSON.stringify({ success: true, objectId: tempId }),
      };
    }

    case "createShape": {
      const tempId = generateTempId();
      const op: AIOperation = {
        type: "createShape",
        tempId,
        shapeType: toolInput.shapeType as "rectangle" | "circle",
        x: toolInput.x as number,
        y: toolInput.y as number,
        w: toolInput.width as number,
        h: toolInput.height as number,
        fill: toolInput.fill as string | undefined,
      };
      tempIdMap.set(tempId, tempId);
      return {
        operation: op,
        result: JSON.stringify({ success: true, objectId: tempId }),
      };
    }

    case "createText": {
      const tempId = generateTempId();
      const op: AIOperation = {
        type: "createText",
        tempId,
        x: toolInput.x as number,
        y: toolInput.y as number,
        text: toolInput.text as string,
        fontSize: toolInput.fontSize as number | undefined,
        fill: toolInput.fill as string | undefined,
        width: toolInput.width as number | undefined,
        fontFamily: toolInput.fontFamily as string | undefined,
        fontStyle: toolInput.fontStyle as "normal" | "bold" | "italic" | "bold italic" | undefined,
        textDecoration: toolInput.textDecoration as "none" | "underline" | undefined,
      };
      tempIdMap.set(tempId, tempId);
      return {
        operation: op,
        result: JSON.stringify({ success: true, objectId: tempId }),
      };
    }

    case "createConnector": {
      const tempId = generateTempId();
      const op: AIOperation = {
        type: "createConnector",
        tempId,
        fromId: toolInput.fromId as string,
        toId: toolInput.toId as string,
        style: toolInput.style as "line" | "arrow" | "double-arrow" | undefined,
        lineStyle: toolInput.lineStyle as "solid" | "dashed" | "dotted" | undefined,
      };
      tempIdMap.set(tempId, tempId);
      return {
        operation: op,
        result: JSON.stringify({ success: true, objectId: tempId }),
      };
    }

    case "moveObject": {
      const op: AIOperation = {
        type: "moveObject",
        objectId: toolInput.objectId as string,
        x: toolInput.x as number,
        y: toolInput.y as number,
      };
      return {
        operation: op,
        result: JSON.stringify({ success: true, objectId: toolInput.objectId }),
      };
    }

    case "resizeObject": {
      const op: AIOperation = {
        type: "resizeObject",
        objectId: toolInput.objectId as string,
        w: toolInput.width as number,
        h: toolInput.height as number,
      };
      return {
        operation: op,
        result: JSON.stringify({ success: true, objectId: toolInput.objectId }),
      };
    }

    case "updateText": {
      const op: AIOperation = {
        type: "updateText",
        objectId: toolInput.objectId as string,
        newText: toolInput.newText as string,
        fontFamily: toolInput.fontFamily as string | undefined,
        fontStyle: toolInput.fontStyle as "normal" | "bold" | "italic" | "bold italic" | undefined,
        textDecoration: toolInput.textDecoration as "none" | "underline" | undefined,
      };
      return {
        operation: op,
        result: JSON.stringify({ success: true, objectId: toolInput.objectId }),
      };
    }

    case "changeColor": {
      const op: AIOperation = {
        type: "changeColor",
        objectId: toolInput.objectId as string,
        color: toolInput.color as string,
      };
      return {
        operation: op,
        result: JSON.stringify({ success: true, objectId: toolInput.objectId }),
      };
    }

    case "updateConnector": {
      const op: AIOperation = {
        type: "updateConnector",
        objectId: toolInput.objectId as string,
        style: toolInput.style as "line" | "arrow" | "double-arrow" | undefined,
        lineStyle: toolInput.lineStyle as "solid" | "dashed" | "dotted" | undefined,
        strokeWidth: toolInput.strokeWidth as number | undefined,
      };
      return {
        operation: op,
        result: JSON.stringify({ success: true, objectId: toolInput.objectId }),
      };
    }

    case "deleteObjects": {
      const objectIds = toolInput.objectIds as string[];
      const op: AIOperation = {
        type: "deleteObjects",
        objectIds,
      };
      return {
        operation: op,
        result: JSON.stringify({ success: true, deleted: objectIds.length }),
      };
    }

    case "getBoardState": {
      return {
        operation: null,
        result: formatBoardStateFull(boardState),
      };
    }

    case "createGrid": {
      const gridId = generateTempId();
      const cols = toolInput.columns as number;
      const rows = toolInput.rows as number;
      const cells = toolInput.cells as { title: string; color?: string; items: string[] }[];
      const cellW = (toolInput.cellWidth as number) || 450;
      const gap = 40;
      const baseX = toolInput.x as number;
      const baseY = toolInput.y as number;
      const stickyW = cellW - 40; // 20px padding on each side
      const stickyH = 80;
      const stickyPadLeft = 20;
      const stickyPadTop = 60; // room for frame title
      const stickyGap = 15;
      const framePadBottom = 25;
      const createdIds: string[] = [];

      // Auto-compute frame height per row (tallest cell in that row wins)
      const rowHeights: number[] = [];
      for (let r = 0; r < rows; r++) {
        let maxItems = 0;
        for (let c = 0; c < cols; c++) {
          const cell = cells[r * cols + c];
          if (cell) maxItems = Math.max(maxItems, cell.items.length);
        }
        const itemsH = maxItems * stickyH + Math.max(0, maxItems - 1) * stickyGap;
        rowHeights.push(Math.max(stickyPadTop + itemsH + framePadBottom, 200));
      }

      // If explicit cellHeight provided, use that as minimum
      const explicitH = toolInput.cellHeight as number | undefined;
      if (explicitH) {
        for (let r = 0; r < rows; r++) {
          rowHeights[r] = Math.max(rowHeights[r], explicitH);
        }
      }

      const ops: AIOperation[] = [];

      // Compute cumulative Y offsets per row
      let cumulativeY = baseY;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const cell = cells[idx];
          if (!cell) continue;

          const fx = baseX + c * (cellW + gap);
          const fy = cumulativeY;

          const frameId = generateTempId();
          createdIds.push(frameId);
          tempIdMap.set(frameId, frameId);

          ops.push({
            type: "createFrame",
            tempId: frameId,
            x: fx,
            y: fy,
            title: cell.title,
            w: cellW,
            h: rowHeights[r],
          });

          cell.items.forEach((text, i) => {
            const sId = generateTempId();
            createdIds.push(sId);
            tempIdMap.set(sId, sId);
            ops.push({
              type: "createStickyNote",
              tempId: sId,
              x: fx + stickyPadLeft,
              y: fy + stickyPadTop + i * (stickyH + stickyGap),
              text,
              color: cell.color,
              w: stickyW,
              h: stickyH,
            });
          });
        }
        cumulativeY += rowHeights[r] + gap;
      }

      tempIdMap.set(gridId, gridId);
      return {
        operation: null,
        result: JSON.stringify({ success: true, gridId, createdIds, operationCount: ops.length }),
        extraOps: ops,
      };
    }

    case "createRow": {
      const rowId = generateTempId();
      const frames = toolInput.frames as { title: string; color?: string; items: string[] }[];
      const frameW = (toolInput.frameWidth as number) || 380;
      const gap = 40;
      const baseX = toolInput.x as number;
      const baseY = toolInput.y as number;
      const stickyW = frameW - 40; // 20px padding on each side
      const stickyH = 80;
      const stickyPadLeft = 20;
      const stickyPadTop = 60;
      const stickyGap = 15;
      const framePadBottom = 25;
      const addConnectors = (toolInput.connectors as boolean) || false;
      const createdIds: string[] = [];
      const frameIds: string[] = [];

      // Auto-compute uniform frame height (tallest frame wins so row is aligned)
      const maxItems = Math.max(...frames.map((f) => f.items.length), 0);
      const itemsH = maxItems * stickyH + Math.max(0, maxItems - 1) * stickyGap;
      let frameH = Math.max(stickyPadTop + itemsH + framePadBottom, 200);

      // If explicit frameHeight provided, use that as minimum
      const explicitH = toolInput.frameHeight as number | undefined;
      if (explicitH) {
        frameH = Math.max(frameH, explicitH);
      }

      const ops: AIOperation[] = [];

      frames.forEach((frame, i) => {
        const fx = baseX + i * (frameW + gap);
        const fy = baseY;

        const frameId = generateTempId();
        frameIds.push(frameId);
        createdIds.push(frameId);
        tempIdMap.set(frameId, frameId);

        ops.push({
          type: "createFrame",
          tempId: frameId,
          x: fx,
          y: fy,
          title: frame.title,
          w: frameW,
          h: frameH,
        });

        frame.items.forEach((text, j) => {
          const sId = generateTempId();
          createdIds.push(sId);
          tempIdMap.set(sId, sId);
          ops.push({
            type: "createStickyNote",
            tempId: sId,
            x: fx + stickyPadLeft,
            y: fy + stickyPadTop + j * (stickyH + stickyGap),
            text,
            color: frame.color,
            w: stickyW,
            h: stickyH,
          });
        });
      });

      // Add connectors between consecutive frames
      if (addConnectors) {
        for (let i = 0; i < frameIds.length - 1; i++) {
          const cId = generateTempId();
          createdIds.push(cId);
          tempIdMap.set(cId, cId);
          ops.push({
            type: "createConnector",
            tempId: cId,
            fromId: frameIds[i],
            toId: frameIds[i + 1],
            style: "arrow",
          });
        }
      }

      tempIdMap.set(rowId, rowId);
      return {
        operation: null,
        result: JSON.stringify({ success: true, rowId, createdIds, operationCount: ops.length }),
        extraOps: ops,
      };
    }

    case "createFlowchart": {
      const flowId = generateTempId();
      type FlowStep = {
        label: string;
        description?: string;
        color?: string;
        branches?: {
          label: string;
          color?: string;
          steps: { label: string; description?: string; color?: string }[];
        }[];
      };
      const steps = toolInput.steps as FlowStep[];
      const direction = (toolInput.direction as string) || "vertical";
      const nodeW = (toolInput.nodeWidth as number) || 240;
      const nodeH = (toolInput.nodeHeight as number) || 72;
      const headerBandH = 28;
      const gap = 100;
      const baseX = toolInput.x as number;
      const baseY = toolInput.y as number;
      const createdIds: string[] = [];
      const stepIds: string[] = [];

      const ops: AIOperation[] = [];

      // ── Color helpers (architecture-style) ──
      const hexToCardBg = (hex: string): string => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const dr = Math.round(r * 0.12 + 12);
        const dg = Math.round(g * 0.12 + 12);
        const db = Math.round(b * 0.12 + 12);
        return `#${dr.toString(16).padStart(2, "0")}${dg.toString(16).padStart(2, "0")}${db.toString(16).padStart(2, "0")}`;
      };

      // Helper: create a styled node (shadow + dark card + header band + text)
      const createNode = (
        x: number,
        y: number,
        label: string,
        color: string,
        desc?: string
      ): string => {
        const cardBg = hexToCardBg(color);

        // Drop shadow
        ops.push({
          type: "createShape",
          tempId: generateTempId(),
          shapeType: "rectangle",
          x: x + 3,
          y: y + 3,
          w: nodeW,
          h: nodeH,
          fill: "rgba(0,0,0,0.4)",
          cornerRadius: 12,
        });

        // Card body (dark tinted background)
        const shapeId = generateTempId();
        createdIds.push(shapeId);
        tempIdMap.set(shapeId, shapeId);
        ops.push({
          type: "createShape",
          tempId: shapeId,
          shapeType: "rectangle",
          x,
          y,
          w: nodeW,
          h: nodeH,
          fill: cardBg,
          cornerRadius: 12,
          stroke: color,
          strokeWidth: 1,
        });

        // Colored header band (top portion)
        ops.push({
          type: "createShape",
          tempId: generateTempId(),
          shapeType: "rectangle",
          x,
          y,
          w: nodeW,
          h: headerBandH,
          fill: color,
          cornerRadius: 12,
        });
        // Square off bottom of header band
        ops.push({
          type: "createShape",
          tempId: generateTempId(),
          shapeType: "rectangle",
          x,
          y: y + 14,
          w: nodeW,
          h: 14,
          fill: color,
        });

        // Label text in header band
        const labelId = generateTempId();
        createdIds.push(labelId);
        tempIdMap.set(labelId, labelId);
        ops.push({
          type: "createText",
          tempId: labelId,
          x: x + 14,
          y: y + 6,
          text: label,
          fontSize: 13,
          fontStyle: "bold",
          fill: "#ffffff",
          width: nodeW - 28,
        });

        // Description text below header band
        if (desc) {
          const descId = generateTempId();
          createdIds.push(descId);
          tempIdMap.set(descId, descId);
          ops.push({
            type: "createText",
            tempId: descId,
            x: x + 14,
            y: y + headerBandH + 8,
            text: desc,
            fontSize: 11,
            fill: "#cbd5e1",
            width: nodeW - 28,
          });
        }

        return shapeId;
      };

      // Helper: create a connector with architecture-style stroke
      const createConn = (
        fromId: string,
        toId: string,
        style: "arrow" | "line" = "arrow",
        routing: "elbowed" | "straight" | "curved" = "elbowed",
        strokeColor = "#4b5563",
        lineStyle: "solid" | "dashed" | "dotted" = "solid"
      ) => {
        const cId = generateTempId();
        createdIds.push(cId);
        tempIdMap.set(cId, cId);
        ops.push({
          type: "createConnector",
          tempId: cId,
          fromId,
          toId,
          style,
          routingMode: routing,
          stroke: strokeColor,
          strokeWidth: 2,
          lineStyle,
        });
      };

      // ── Compute backdrop bounds ──
      // We need to know total size for the dark backdrop, so pre-compute positions.
      let totalW = nodeW;
      let totalH = steps.length * nodeH + (steps.length - 1) * gap;
      // Account for branches extending right
      let maxBranchExtent = 0;
      steps.forEach((step) => {
        if (step.branches) {
          step.branches.forEach((branch, bIdx) => {
            const branchOffsetX = nodeW + 140 + bIdx * (nodeW + 140);
            const branchExtent = branchOffsetX + nodeW;
            maxBranchExtent = Math.max(maxBranchExtent, branchExtent);
            const branchH = branch.steps.length * nodeH + (branch.steps.length - 1) * 70;
            totalH = Math.max(totalH, branchH);
          });
        }
      });
      if (maxBranchExtent > 0) totalW = maxBranchExtent;

      const backdropPad = 60;
      // Dark backdrop
      ops.push({
        type: "createShape",
        tempId: generateTempId(),
        shapeType: "rectangle",
        x: baseX - backdropPad,
        y: baseY - backdropPad,
        w: totalW + backdropPad * 2,
        h: steps.length * (nodeH + gap) - gap + backdropPad * 2,
        fill: "#08080d",
        cornerRadius: 24,
      });

      // ── Layout main flow ──
      steps.forEach((step, i) => {
        const sx = direction === "horizontal" ? baseX + i * (nodeW + gap) : baseX;
        const sy = direction === "horizontal" ? baseY : baseY + i * (nodeH + gap);

        const shapeId = createNode(sx, sy, step.label, step.color ?? "#3b82f6", step.description);
        stepIds.push(shapeId);

        // Render branches forking off to the right
        if (step.branches && step.branches.length > 0) {
          step.branches.forEach((branch, bIdx) => {
            const branchColor = branch.color ?? "#ef4444";
            const branchGap = 70;
            const branchOffsetX = nodeW + 140 + bIdx * (nodeW + 140);
            const branchNodeIds: string[] = [];

            branch.steps.forEach((bStep, j) => {
              const bx = direction === "horizontal" ? sx : sx + branchOffsetX;
              const by =
                direction === "horizontal" ? sy + branchOffsetX : sy + j * (nodeH + branchGap);

              const bId = createNode(
                bx,
                by,
                bStep.label,
                bStep.color ?? branchColor,
                bStep.description
              );
              branchNodeIds.push(bId);
            });

            // Connect main step → first branch node with dashed connector
            if (branchNodeIds.length > 0) {
              createConn(shapeId, branchNodeIds[0], "arrow", "elbowed", branchColor, "dashed");

              // Branch label badge midway on the connector arm
              const labelX =
                direction === "horizontal"
                  ? sx + nodeW / 2 - 30
                  : sx + nodeW + (branchOffsetX - nodeW) / 2 - 40;
              const labelY = direction === "horizontal" ? sy + nodeW + 10 : sy + nodeH / 2 - 14;

              // Small badge background
              ops.push({
                type: "createShape",
                tempId: generateTempId(),
                shapeType: "rectangle",
                x: labelX - 4,
                y: labelY - 3,
                w: 88,
                h: 22,
                fill: hexToCardBg(branchColor),
                cornerRadius: 6,
                stroke: `${branchColor}60`,
                strokeWidth: 1,
              });
              const branchLabelId = generateTempId();
              createdIds.push(branchLabelId);
              tempIdMap.set(branchLabelId, branchLabelId);
              ops.push({
                type: "createText",
                tempId: branchLabelId,
                x: labelX,
                y: labelY,
                text: branch.label,
                fontSize: 11,
                fontStyle: "bold",
                fill: branchColor,
                width: 80,
              });
            }

            // Connect branch steps sequentially
            for (let j = 0; j < branchNodeIds.length - 1; j++) {
              createConn(
                branchNodeIds[j],
                branchNodeIds[j + 1],
                "arrow",
                "elbowed",
                `${branchColor}90`
              );
            }
          });
        }
      });

      // Connect main flow steps sequentially
      // Use the target step's color for the connector if it's green (success)
      for (let i = 0; i < stepIds.length - 1; i++) {
        const targetColor = steps[i + 1].color ?? "#3b82f6";
        const isGreen =
          targetColor.toLowerCase().startsWith("#22c5") ||
          targetColor.toLowerCase().startsWith("#10b9") ||
          targetColor.toLowerCase().startsWith("#16a3");
        createConn(stepIds[i], stepIds[i + 1], "arrow", "elbowed", isGreen ? "#22c55e" : "#6b7280");
      }

      tempIdMap.set(flowId, flowId);
      return {
        operation: null,
        result: JSON.stringify({
          success: true,
          flowchartId: flowId,
          createdIds,
          operationCount: ops.length,
        }),
        extraOps: ops,
      };
    }

    case "createMindMap": {
      const mapId = generateTempId();
      const centerLabel = toolInput.centerLabel as string;
      const branches = toolInput.branches as {
        label: string;
        color?: string;
        children?: string[];
      }[];
      const cx = toolInput.x as number;
      const cy = toolInput.y as number;
      const createdIds: string[] = [];

      const ops: AIOperation[] = [];

      // ── Dark backdrop (architecture-style) ──
      const n = branches.length;
      const branchRadius = Math.max(380, 250 + n * 30);
      const backdropPad = 280; // extra room for children
      const backdropSize = (branchRadius + backdropPad) * 2;
      ops.push({
        type: "createShape",
        tempId: generateTempId(),
        shapeType: "rectangle",
        x: cx - backdropSize / 2,
        y: cy - backdropSize / 2,
        w: backdropSize,
        h: backdropSize,
        fill: "#08080d",
        cornerRadius: 24,
      });

      // ── Center node — glow ring + solid circle ──
      const centerSize = 180;

      // Glow ring (larger, translucent)
      ops.push({
        type: "createShape",
        tempId: generateTempId(),
        shapeType: "circle",
        x: cx - (centerSize + 20) / 2,
        y: cy - (centerSize + 20) / 2,
        w: centerSize + 20,
        h: centerSize + 20,
        fill: "rgba(139,92,246,0.15)",
      });

      const centerId = generateTempId();
      createdIds.push(centerId);
      tempIdMap.set(centerId, centerId);
      ops.push({
        type: "createShape",
        tempId: centerId,
        shapeType: "circle",
        x: cx - centerSize / 2,
        y: cy - centerSize / 2,
        w: centerSize,
        h: centerSize,
        fill: "#8b5cf6",
      });

      // Center label
      const centerTextId = generateTempId();
      createdIds.push(centerTextId);
      tempIdMap.set(centerTextId, centerTextId);
      ops.push({
        type: "createText",
        tempId: centerTextId,
        x: cx - 70,
        y: cy - 20,
        text: centerLabel,
        fontSize: 18,
        fill: "#ffffff",
        width: 140,
        fontStyle: "bold",
      });

      // ── Branch cards ──
      const branchW = 200;
      const branchH = 56;
      const shadowDx = 3;
      const shadowDy = 3;

      const defaultColors = [
        "#3b82f6",
        "#22c55e",
        "#f59e0b",
        "#ef4444",
        "#ec4899",
        "#06b6d4",
        "#f97316",
        "#8b5cf6",
      ];

      // Hex to dark card tint (architecture-style)
      const hexToCardBg = (hex: string): string => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        // Very dark tinted card (10% of original + dark base)
        const dr = Math.round(r * 0.12 + 12);
        const dg = Math.round(g * 0.12 + 12);
        const db = Math.round(b * 0.12 + 12);
        return `#${dr.toString(16).padStart(2, "0")}${dg.toString(16).padStart(2, "0")}${db.toString(16).padStart(2, "0")}`;
      };

      // Hex to child card bg (slightly lighter dark tint)
      const hexToChildBg = (hex: string): string => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const dr = Math.round(r * 0.08 + 18);
        const dg = Math.round(g * 0.08 + 18);
        const db = Math.round(b * 0.08 + 18);
        return `#${dr.toString(16).padStart(2, "0")}${dg.toString(16).padStart(2, "0")}${db.toString(16).padStart(2, "0")}`;
      };

      branches.forEach((branch, i) => {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const bx = cx + branchRadius * cosA - branchW / 2;
        const by = cy + branchRadius * sinA - branchH / 2;

        const fillColor = branch.color ?? defaultColors[i % defaultColors.length];
        const cardBg = hexToCardBg(fillColor);

        // Drop shadow
        ops.push({
          type: "createShape",
          tempId: generateTempId(),
          shapeType: "rectangle",
          x: bx + shadowDx,
          y: by + shadowDy,
          w: branchW,
          h: branchH,
          fill: "rgba(0,0,0,0.4)",
          cornerRadius: 12,
        });

        // Card body with colored top band
        const branchId = generateTempId();
        createdIds.push(branchId);
        tempIdMap.set(branchId, branchId);
        ops.push({
          type: "createShape",
          tempId: branchId,
          shapeType: "rectangle",
          x: bx,
          y: by,
          w: branchW,
          h: branchH,
          fill: cardBg,
          cornerRadius: 12,
          stroke: fillColor,
          strokeWidth: 1,
        });

        // Colored header band (top portion)
        ops.push({
          type: "createShape",
          tempId: generateTempId(),
          shapeType: "rectangle",
          x: bx,
          y: by,
          w: branchW,
          h: 28,
          fill: fillColor,
          cornerRadius: 12,
        });
        // Square off bottom of header
        ops.push({
          type: "createShape",
          tempId: generateTempId(),
          shapeType: "rectangle",
          x: bx,
          y: by + 14,
          w: branchW,
          h: 14,
          fill: fillColor,
        });

        // Branch label in header band
        const branchTextId = generateTempId();
        createdIds.push(branchTextId);
        tempIdMap.set(branchTextId, branchTextId);
        ops.push({
          type: "createText",
          tempId: branchTextId,
          x: bx + 14,
          y: by + 6,
          text: branch.label,
          fontSize: 13,
          fontStyle: "bold",
          fill: "#ffffff",
          width: branchW - 28,
        });

        // Curved connector from center to branch
        const connId = generateTempId();
        createdIds.push(connId);
        tempIdMap.set(connId, connId);
        ops.push({
          type: "createConnector",
          tempId: connId,
          fromId: centerId,
          toId: branchId,
          style: "line",
          routingMode: "curved",
          stroke: fillColor,
          strokeWidth: 2,
        });

        // ── Children: dark cards with colored accent ──
        if (branch.children && branch.children.length > 0) {
          const childW = 170;
          const childH = 48;
          const childGap = 8;
          const childBg = hexToChildBg(fillColor);

          const totalH = branch.children.length * childH + (branch.children.length - 1) * childGap;

          const isRight = cosA >= 0;
          const isBottom = sinA >= 0;

          let childAnchorX: number;
          let childAnchorY: number;

          if (Math.abs(cosA) >= Math.abs(sinA)) {
            childAnchorX = isRight ? bx + branchW + 24 : bx - childW - 24;
            childAnchorY = by + branchH / 2 - totalH / 2;
          } else {
            childAnchorX = bx + branchW / 2 - childW / 2;
            childAnchorY = isBottom ? by + branchH + 24 : by - totalH - 24;
          }

          // Pre-create child IDs so we can emit connectors FIRST (behind cards)
          const childIds: string[] = [];
          branch.children.forEach(() => {
            const childId = generateTempId();
            childIds.push(childId);
            createdIds.push(childId);
            tempIdMap.set(childId, childId);
          });

          // Emit connectors first (lower z-index → renders behind cards)
          childIds.forEach((childId) => {
            const childConnId = generateTempId();
            createdIds.push(childConnId);
            tempIdMap.set(childConnId, childConnId);
            ops.push({
              type: "createConnector",
              tempId: childConnId,
              fromId: branchId,
              toId: childId,
              style: "line",
              lineStyle: "dotted",
              stroke: `${fillColor}60`,
              strokeWidth: 1,
            });
          });

          // Now emit the actual child cards (on top of connectors)
          branch.children.forEach((childText, j) => {
            const childX = childAnchorX;
            const childY = childAnchorY + j * (childH + childGap);

            // Child shadow
            ops.push({
              type: "createShape",
              tempId: generateTempId(),
              shapeType: "rectangle",
              x: childX + 2,
              y: childY + 2,
              w: childW,
              h: childH,
              fill: "rgba(0,0,0,0.3)",
              cornerRadius: 8,
            });

            // Child card
            ops.push({
              type: "createShape",
              tempId: childIds[j],
              shapeType: "rectangle",
              x: childX,
              y: childY,
              w: childW,
              h: childH,
              fill: childBg,
              cornerRadius: 8,
              stroke: `${fillColor}40`,
              strokeWidth: 1,
            });

            // Left accent bar
            ops.push({
              type: "createShape",
              tempId: generateTempId(),
              shapeType: "rectangle",
              x: childX,
              y: childY + 8,
              w: 3,
              h: childH - 16,
              fill: fillColor,
            });

            // Child text
            ops.push({
              type: "createText",
              tempId: generateTempId(),
              x: childX + 12,
              y: childY + childH / 2 - 8,
              text: childText,
              fontSize: 12,
              fill: "#e2e8f0",
              width: childW - 20,
            });
          });
        }
      });

      tempIdMap.set(mapId, mapId);
      return {
        operation: null,
        result: JSON.stringify({
          success: true,
          mindMapId: mapId,
          createdIds,
          operationCount: ops.length,
        }),
        extraOps: ops,
      };
    }

    default:
      return {
        operation: null,
        result: JSON.stringify({
          success: false,
          error: `Unknown tool: ${toolName}`,
        }),
      };
  }
}
