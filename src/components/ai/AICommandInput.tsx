"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAIAgent } from "@/hooks/useAIAgent";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Send, ChevronDown, ChevronUp, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AICommandInputProps {
  boardId: string;
}

export default function AICommandInput({ boardId }: AICommandInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [command, setCommand] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { submitCommand, loading, error, lastResult, history, clearError } = useAIAgent(boardId);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async () => {
    if (!command.trim() || loading) return;
    const cmd = command;
    setCommand("");
    const result = await submitCommand(cmd);
    if (result?.success) {
      toast.success(result.message || "Done!");
    } else if (result?.error) {
      toast.error(result.error);
    }
  }, [command, loading, submitCommand]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
      // Stop propagation so canvas keyboard shortcuts don't fire
      e.stopPropagation();
    },
    [handleSubmit]
  );

  // Toggle button (always visible)
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full",
          "border border-zinc-200/80 bg-white/90 px-4 py-2.5 text-sm font-medium text-zinc-700",
          "shadow-lg backdrop-blur-sm transition-all hover:bg-zinc-50 hover:shadow-xl",
          "dark:border-zinc-700/80 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:bg-zinc-800"
        )}
      >
        <Sparkles className="size-4" />
        AI Agent
      </button>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 w-80 rounded-lg border shadow-xl",
        "border-zinc-200/80 bg-white/95 backdrop-blur-sm",
        "dark:border-zinc-700/80 dark:bg-zinc-900/95"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200/80 px-3 py-2 dark:border-zinc-700/80">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          <Sparkles className="size-4 text-violet-500" />
          AI Agent
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Input area */}
      <div className="p-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={command}
            onChange={(e) => {
              setCommand(e.target.value);
              if (error) clearError();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI to create, move, organize..."
            disabled={loading}
            className={cn(
              "flex h-9 w-full rounded-md border border-zinc-200 bg-transparent px-3 py-1 text-sm shadow-xs",
              "placeholder:text-zinc-400",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "dark:border-zinc-700 dark:placeholder:text-zinc-500"
            )}
          />
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={loading || !command.trim()}
            className="shrink-0"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>

        {/* Status feedback */}
        {loading && <p className="mt-2 text-xs text-zinc-500">Processing command...</p>}
        {error && !loading && (
          <p className="mt-2 text-xs text-red-500 dark:text-red-400">{error}</p>
        )}
        {lastResult?.success && !loading && (
          <p className="mt-2 text-xs text-green-600 dark:text-green-400">{lastResult.message}</p>
        )}
      </div>

      {/* Command history */}
      {history.length > 0 && (
        <div className="border-t border-zinc-200/80 dark:border-zinc-700/80">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          >
            <span>History ({history.length})</span>
            {showHistory ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
          {showHistory && (
            <div className="max-h-40 overflow-y-auto px-3 pb-2">
              {history.map((entry, i) => (
                <button
                  key={i}
                  className="mb-1 flex w-full items-start gap-2 rounded px-2 py-1 text-left text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  onClick={() => setCommand(entry.command)}
                >
                  <span
                    className={cn(
                      "mt-0.5 shrink-0 rounded px-1 py-0.5 text-[9px] font-medium leading-none",
                      entry.result.success
                        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                    )}
                  >
                    {entry.result.success ? "OK" : "ERR"}
                  </span>
                  <span className="truncate text-zinc-600 dark:text-zinc-300">{entry.command}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Example commands hint */}
      <div className="border-t border-zinc-200/80 px-3 py-2 dark:border-zinc-700/80">
        <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
          Try: &quot;Create a SWOT analysis&quot; or &quot;Add 3 sticky notes for action items&quot;
        </p>
      </div>
    </div>
  );
}
