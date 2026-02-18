import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { AI_TOOLS, type AIOperation } from "@/lib/ai-tools";
import { AI_SYSTEM_PROMPT } from "@/lib/ai-system-prompt";
import { z } from "zod";

// ── Request validation ─────────────────────────────────────────────
const RequestSchema = z.object({
  command: z.string().min(1).max(2000),
  boardState: z.array(z.record(z.string(), z.unknown())),
  viewportCenter: z
    .object({ x: z.number(), y: z.number() })
    .optional(),
});

// ── Temp ID generation (server-side, for tracking across tool rounds) ──
let tempCounter = 0;
function generateTempId(): string {
  return `temp_${Date.now()}_${tempCounter++}`;
}

// ── Board state formatter ──────────────────────────────────────────
function getShapeBounds(s: Record<string, unknown>): { x: number; y: number; w: number; h: number } | null {
  const type = s.type as string;
  const x = s.x as number;
  const y = s.y as number;

  switch (type) {
    case "sticky":
    case "rect":
    case "frame":
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

function computeOccupiedRegion(
  shapes: Record<string, unknown>[],
  viewportCenter?: { x: number; y: number },
): string {
  if (shapes.length === 0) return "";

  const bounds = shapes.map(getShapeBounds).filter((b): b is NonNullable<typeof b> => b !== null);
  if (bounds.length === 0) return "";

  const minX = Math.min(...bounds.map((b) => b.x));
  const minY = Math.min(...bounds.map((b) => b.y));
  const maxX = Math.max(...bounds.map((b) => b.x + b.w));
  const maxY = Math.max(...bounds.map((b) => b.y + b.h));

  let hint = `\nOccupied region: top-left=(${Math.round(minX)}, ${Math.round(minY)}) to bottom-right=(${Math.round(maxX)}, ${Math.round(maxY)}).`;

  // Suggest open placement area — to the right or below existing content
  const rightOfExisting = Math.round(maxX) + 80;
  const belowExisting = Math.round(maxY) + 80;

  if (viewportCenter) {
    // If viewport center is far from existing content, suggest near viewport
    const vcx = viewportCenter.x;
    const vcy = viewportCenter.y;
    const isFarFromContent = vcx > maxX + 200 || vcy > maxY + 200 || vcx < minX - 200 || vcy < minY - 200;

    if (isFarFromContent) {
      hint += ` The user's viewport is far from existing content — place new objects near viewport center (${vcx}, ${vcy}).`;
    } else {
      hint += ` Suggested open space: start at x=${rightOfExisting} (right of existing) or y=${belowExisting} (below existing). Do NOT overlap the occupied region.`;
    }
  } else {
    hint += ` Suggested open space: start at x=${rightOfExisting} (right of existing) or y=${belowExisting} (below existing).`;
  }

  return hint;
}

function formatBoardState(
  shapes: Record<string, unknown>[],
  viewportCenter?: { x: number; y: number },
): string {
  if (shapes.length === 0) return "The board is currently empty.";

  const lines = shapes.map((s) => {
    const id = s.id as string;
    const type = s.type as string;
    const x = Math.round(s.x as number);
    const y = Math.round(s.y as number);
    const base = `- [${id}] ${type} top-left=(${x}, ${y})`;

    switch (type) {
      case "sticky":
        return `${base} text="${s.text}" color=${s.color} ${s.w}×${s.h}`;
      case "text":
        return `${base} text="${s.text}"`;
      case "frame":
        return `${base} title="${s.title}" ${s.w}×${s.h}`;
      case "rect":
        return `${base} ${s.w}×${s.h} fill=${s.fill}`;
      case "circle":
        return `${base} r=${s.radiusX}×${s.radiusY} fill=${s.fill}`;
      case "connector":
        return `${base} ${s.fromId} → ${s.toId} (${s.style})`;
      case "line":
        return `${base} stroke=${s.stroke}`;
      default:
        return base;
    }
  });

  const occupiedHint = computeOccupiedRegion(shapes, viewportCenter);

  return `The board has ${shapes.length} objects:\n${lines.join("\n")}${occupiedHint}`;
}

// ── Tool call simulation ───────────────────────────────────────────
// Returns an AIOperation + a simulated tool result string for Claude
function simulateToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  boardState: Record<string, unknown>[],
  tempIdMap: Map<string, string>,
): { operation: AIOperation | null; result: string } {
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
        style: toolInput.style as "line" | "arrow" | undefined,
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

    case "deleteObject": {
      const op: AIOperation = {
        type: "deleteObject",
        objectId: toolInput.objectId as string,
      };
      return {
        operation: op,
        result: JSON.stringify({ success: true, objectId: toolInput.objectId }),
      };
    }

    case "getBoardState": {
      return {
        operation: null,
        result: JSON.stringify({
          success: true,
          objects: boardState,
        }),
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

// ── Main handler ───────────────────────────────────────────────────
const MAX_TOOL_ROUNDS = 15;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request: " + parsed.error.message },
        { status: 400 },
      );
    }

    const { command, boardState, viewportCenter } = parsed.data;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: "AI agent not configured (missing API key)" },
        { status: 500 },
      );
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Format board state for Claude context (includes occupied region + open space hints)
    const boardSummary = formatBoardState(boardState, viewportCenter ?? undefined);
    const viewportHint = viewportCenter
      ? `\nThe user is currently viewing the area around (${viewportCenter.x}, ${viewportCenter.y}).`
      : "";
    const userMessage = `Current board state:\n${boardSummary}${viewportHint}\n\nUser command: ${command}`;

    // Build initial messages
    let messages: Anthropic.Messages.MessageParam[] = [
      { role: "user", content: userMessage },
    ];

    const operations: AIOperation[] = [];
    const tempIdMap = new Map<string, string>();
    let finalText = "";

    // Tool-use loop
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        system: AI_SYSTEM_PROMPT,
        tools: AI_TOOLS,
        messages,
      });

      // Collect text from this response
      for (const block of response.content) {
        if (block.type === "text") {
          finalText = block.text;
        }
      }

      // Find tool_use blocks
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.Messages.ToolUseBlock =>
          block.type === "tool_use",
      );

      // If no tool calls or end_turn, we're done
      if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") {
        break;
      }

      // Add assistant response to conversation
      messages = [...messages, { role: "assistant", content: response.content }];

      // Execute each tool call and build tool_result messages
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const toolBlock of toolUseBlocks) {
        const { operation, result } = simulateToolCall(
          toolBlock.name,
          toolBlock.input as Record<string, unknown>,
          boardState,
          tempIdMap,
        );

        if (operation) {
          operations.push(operation);
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolBlock.id,
          content: result,
        });
      }

      messages = [...messages, { role: "user", content: toolResults }];
    }

    return NextResponse.json({
      success: true,
      operations,
      message: finalText || "Command executed successfully.",
    });
  } catch (err) {
    console.error("AI command error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
