import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { AI_TOOLS, type AIOperation } from "@/lib/ai-tools";
import { AI_SYSTEM_PROMPT } from "@/lib/ai-system-prompt";
import { getLangfuse } from "@/lib/langfuse";
import { formatBoardSummary, simulateToolCall } from "@/lib/ai-simulate";
import { z } from "zod";

const AI_MODEL = "claude-haiku-4-5-20251001";

// ── Request validation ─────────────────────────────────────────────
const RequestSchema = z.object({
  command: z.string().min(1).max(2000),
  boardState: z.array(z.record(z.string(), z.unknown())),
  viewportCenter: z.object({ x: z.number(), y: z.number() }).optional(),
});

// ── Main handler ───────────────────────────────────────────────────
const MAX_TOOL_ROUNDS = 15;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request: " + parsed.error.message },
        { status: 400 }
      );
    }

    const { command, boardState, viewportCenter } = parsed.data;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: "AI agent not configured (missing API key)" },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // ── LangFuse tracing (no-op if env vars missing) ──
    const startTime = Date.now();
    const langfuse = getLangfuse();
    const trace = langfuse?.trace({
      name: "ai-command",
      input: { command, boardObjectCount: boardState.length, viewportCenter },
      metadata: { model: AI_MODEL },
    });

    // Format board state for Claude context (includes occupied region + open space hints)
    const boardSummary = formatBoardSummary(boardState, viewportCenter ?? undefined);
    const viewportHint = viewportCenter
      ? `\nThe user is currently viewing the area around (${viewportCenter.x}, ${viewportCenter.y}).`
      : "";
    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const userMessage = `Today is ${today}.\n\nCurrent board state:\n${boardSummary}${viewportHint}\n\nUser command: ${command}`;

    // Build initial messages
    let messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: userMessage }];

    const operations: AIOperation[] = [];
    const tempIdMap = new Map<string, string>();
    let finalText = "";
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Tool-use loop
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const generation = trace?.generation({
        name: `tool-round-${round}`,
        model: AI_MODEL,
        input: messages,
      });

      const response = await anthropic.messages.create({
        model: AI_MODEL,
        max_tokens: 16384,
        system: [
          {
            type: "text" as const,
            text: AI_SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" as const },
          },
        ],
        tools: AI_TOOLS.map((tool, i) =>
          i === AI_TOOLS.length - 1
            ? { ...tool, cache_control: { type: "ephemeral" as const } }
            : tool
        ),
        messages,
      });

      // Track token usage
      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      // Collect text from this response
      for (const block of response.content) {
        if (block.type === "text") {
          finalText = block.text;
        }
      }

      // Find tool_use blocks
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use"
      );

      generation?.end({
        output: response.content,
        usage: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
        },
        metadata: {
          stopReason: response.stop_reason,
          toolCalls: toolUseBlocks.map((t) => t.name),
        },
      });

      // If no tool calls or end_turn, we're done
      if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") {
        break;
      }

      // Execute each tool call and collect operations
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const toolBlock of toolUseBlocks) {
        const { operation, result, extraOps } = simulateToolCall(
          toolBlock.name,
          toolBlock.input as Record<string, unknown>,
          boardState,
          tempIdMap
        );

        if (operation) {
          operations.push(operation);
        }
        if (extraOps) {
          operations.push(...extraOps);
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolBlock.id,
          content: result,
        });
      }

      messages = [
        ...messages,
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      ];
    }

    // Finalize trace
    const durationMs = Date.now() - startTime;
    trace?.update({
      output: {
        operationCount: operations.length,
        message: finalText || "Command executed successfully.",
      },
      metadata: {
        totalInputTokens,
        totalOutputTokens,
        durationMs,
        operationTypes: operations.map((o) => o.type),
      },
    });

    // Flush traces (non-blocking)
    langfuse?.flushAsync().catch(() => {});

    return NextResponse.json({
      success: true,
      operations,
      message: finalText || "Command executed successfully.",
      durationMs,
    });
  } catch (err) {
    console.error("AI command error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";

    // Log error to LangFuse if available
    const langfuse = getLangfuse();
    langfuse?.flushAsync().catch(() => {});

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
