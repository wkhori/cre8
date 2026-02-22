"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCanvasStore } from "@/store/canvas-store";
import { useUIStore } from "@/store/ui-store";
import { executeAIOperations } from "@/lib/ai-operations";
import { subscribeChatMessages, addChatMessage, type ChatMessage } from "@/lib/ai-chat";
import { getShapeBounds } from "@/lib/shape-geometry";
import type { AIOperation } from "@/lib/ai-tools";

interface AICommandResult {
  success: boolean;
  message: string;
  operations?: AIOperation[];
  error?: string;
}

const COOLDOWN_MS = 2000;
const ARCH_DIAGRAM_REGEX = /^\/arch-diagram\s+(https?:\/\/github\.com\/[\w.-]+\/[\w.-]+)\s*$/i;

/** Read a streaming NDJSON response, calling onPhase for progress updates. */
async function readNDJSONStream(
  body: ReadableStream<Uint8Array>,
  onPhase: (msg: string | null) => void
): Promise<AICommandResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: AICommandResult = { success: false, message: "", error: "Stream ended unexpectedly" };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop()!; // keep incomplete last line

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event.phase === "complete") {
          result = event.data as AICommandResult;
        } else if (event.message) {
          onPhase(event.message);
        }
      } catch {
        // skip malformed lines
      }
    }
  }

  return result;
}

export function useAIAgent(boardId: string | null, uid: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const cooldownRef = useRef(false);

  // Subscribe to Firestore chat messages
  useEffect(() => {
    if (!boardId || !uid) return;
    const unsub = subscribeChatMessages(boardId, uid, setMessages);
    return unsub;
  }, [boardId, uid]);

  const submitCommand = useCallback(
    async (command: string): Promise<AICommandResult | null> => {
      if (!boardId || !uid) return null;

      if (cooldownRef.current) {
        setError("Please wait before sending another command.");
        return null;
      }
      if (!command.trim()) {
        setError("Please enter a command.");
        return null;
      }

      setLoading(true);
      setError(null);

      // Start cooldown
      cooldownRef.current = true;
      setTimeout(() => {
        cooldownRef.current = false;
      }, COOLDOWN_MS);

      try {
        // Write user message to Firestore
        await addChatMessage(boardId, uid, {
          role: "user",
          content: command,
          timestamp: null,
        });

        // Read current board state + viewport position
        const boardState = useCanvasStore.getState().shapes;
        const { viewport } = useUIStore.getState();

        const viewportCenter = {
          x: Math.round((window.innerWidth / 2 - viewport.x) / viewport.scale),
          y: Math.round((window.innerHeight / 2 - viewport.y) / viewport.scale),
        };

        // Compute a clear placement origin avoiding all existing content.
        // Stack rightward until the board gets too wide, then wrap below.
        const MAX_BOARD_WIDTH = 3000;
        let placementOrigin = viewportCenter;
        const spatialShapes = boardState.filter((s) => s.type !== "connector");
        if (spatialShapes.length > 0) {
          let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
          for (const s of spatialShapes) {
            const b = getShapeBounds(s);
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.width);
            maxY = Math.max(maxY, b.y + b.height);
          }
          const boardWidth = maxX - minX;
          if (boardWidth > MAX_BOARD_WIDTH) {
            // Wrap below existing content, back to the left edge
            placementOrigin = {
              x: Math.round(minX),
              y: Math.round(maxY + 200),
            };
          } else {
            // Place to the right
            placementOrigin = {
              x: Math.round(maxX + 200),
              y: Math.round(minY),
            };
          }
        }

        // Route /arch-diagram commands to the repo analysis endpoint
        const archMatch = command.match(ARCH_DIAGRAM_REGEX);
        const endpoint = archMatch ? "/api/analyze-repo" : "/api/ai-command";
        const payload = archMatch
          ? { repoUrl: archMatch[1], viewportCenter: placementOrigin }
          : { command, boardState, viewportCenter: placementOrigin };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        // ── Streaming NDJSON for /api/analyze-repo ───────────────
        let data: AICommandResult;
        if (archMatch && res.body) {
          data = await readNDJSONStream(res.body, setStatusMessage);
        } else {
          data = await res.json();
        }
        setStatusMessage(null);

        if (!res.ok || !data.success) {
          const errorMsg = data.error || `Server error (${res.status})`;
          setError(errorMsg);

          await addChatMessage(boardId, uid, {
            role: "assistant",
            content: errorMsg,
            timestamp: null,
          });

          return { success: false, message: "", error: errorMsg };
        }

        // Execute the operations on the local store
        if (data.operations && data.operations.length > 0) {
          const tempIdMap = executeAIOperations(data.operations);

          // Pan viewport to center on newly created content
          const newIds = new Set(tempIdMap.values());
          if (newIds.size > 0) {
            const allShapes = useCanvasStore.getState().shapes;
            const newShapes = allShapes.filter((s) => newIds.has(s.id) && s.type !== "connector");
            if (newShapes.length > 0) {
              let minX = Infinity,
                minY = Infinity,
                maxX = -Infinity,
                maxY = -Infinity;
              for (const s of newShapes) {
                const b = getShapeBounds(s);
                minX = Math.min(minX, b.x);
                minY = Math.min(minY, b.y);
                maxX = Math.max(maxX, b.x + b.width);
                maxY = Math.max(maxY, b.y + b.height);
              }
              const cx = (minX + maxX) / 2;
              const cy = (minY + maxY) / 2;
              // Small delay so shapes render before panning
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent("pan-to", { detail: { x: cx, y: cy } }));
              }, 100);
            }
          }
        }

        // Write assistant response to Firestore
        await addChatMessage(boardId, uid, {
          role: "assistant",
          content: data.message || "Done!",
          timestamp: null,
          operationCount: data.operations?.length ?? 0,
        });

        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Network error";
        setError(msg);

        // Write error to Firestore
        if (boardId && uid) {
          await addChatMessage(boardId, uid, {
            role: "assistant",
            content: `Error: ${msg}`,
            timestamp: null,
          }).catch(() => {});
        }

        return { success: false, message: "", error: msg };
      } finally {
        setLoading(false);
      }
    },
    [boardId, uid]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    submitCommand,
    loading,
    statusMessage,
    error,
    messages,
    clearError,
  };
}
