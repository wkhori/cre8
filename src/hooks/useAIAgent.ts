"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCanvasStore } from "@/store/canvas-store";
import { useUIStore } from "@/store/ui-store";
import { executeAIOperations } from "@/lib/ai-operations";
import { subscribeChatMessages, addChatMessage, type ChatMessage } from "@/lib/ai-chat";
import type { AIOperation } from "@/lib/ai-tools";

interface AICommandResult {
  success: boolean;
  message: string;
  operations?: AIOperation[];
  error?: string;
}

const COOLDOWN_MS = 2000;

export function useAIAgent(boardId: string | null, uid: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

        const res = await fetch("/api/ai-command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command, boardState, viewportCenter }),
        });

        const data: AICommandResult = await res.json();

        if (!res.ok || !data.success) {
          const errorMsg = data.error || `Server error (${res.status})`;
          setError(errorMsg);

          // Write error response to Firestore
          await addChatMessage(boardId, uid, {
            role: "assistant",
            content: errorMsg,
            timestamp: null,
          });

          return { success: false, message: "", error: errorMsg };
        }

        // Execute the operations on the local store
        if (data.operations && data.operations.length > 0) {
          executeAIOperations(data.operations);
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
    error,
    messages,
    clearError,
  };
}
