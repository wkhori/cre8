"use client";

import { useCallback, useRef, useState } from "react";
import { useCanvasStore } from "@/store/canvas-store";
import { executeAIOperations } from "@/lib/ai-operations";
import type { AIOperation } from "@/lib/ai-tools";

interface AICommandResult {
  success: boolean;
  message: string;
  operations?: AIOperation[];
  error?: string;
}

interface CommandHistoryEntry {
  command: string;
  result: AICommandResult;
  timestamp: number;
}

const COOLDOWN_MS = 2000;
const MAX_HISTORY = 10;

export function useAIAgent(boardId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AICommandResult | null>(null);
  const [history, setHistory] = useState<CommandHistoryEntry[]>([]);
  const cooldownRef = useRef(false);

  const submitCommand = useCallback(
    async (command: string): Promise<AICommandResult | null> => {
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
      setLastResult(null);

      // Start cooldown
      cooldownRef.current = true;
      setTimeout(() => {
        cooldownRef.current = false;
      }, COOLDOWN_MS);

      try {
        // Read current board state from the store
        const boardState = useCanvasStore.getState().shapes;

        const res = await fetch("/api/ai-command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command, boardState }),
        });

        const data: AICommandResult = await res.json();

        if (!res.ok || !data.success) {
          const errorMsg = data.error || `Server error (${res.status})`;
          setError(errorMsg);
          const result = { success: false, message: "", error: errorMsg };
          setLastResult(result);
          return result;
        }

        // Execute the operations on the local store
        if (data.operations && data.operations.length > 0) {
          executeAIOperations(data.operations);
        }

        setLastResult(data);

        // Add to history
        setHistory((prev) => {
          const entry: CommandHistoryEntry = {
            command,
            result: data,
            timestamp: Date.now(),
          };
          return [entry, ...prev].slice(0, MAX_HISTORY);
        });

        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Network error";
        setError(msg);
        const result = { success: false, message: "", error: msg };
        setLastResult(result);
        return result;
      } finally {
        setLoading(false);
      }
    },
    [boardId],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    submitCommand,
    loading,
    error,
    lastResult,
    history,
    clearError,
  };
}
