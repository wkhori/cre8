"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAIAgent } from "@/hooks/useAIAgent";
import { useUIStore } from "@/store/ui-store";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Sparkles,
  Send,
  X,
  Zap,
  Wand2,
  LayoutGrid,
  StickyNote,
  ArrowRightLeft,
  Lightbulb,
  ListChecks,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/ai-chat";
import { addChatMessage } from "@/lib/ai-chat";

const EXAMPLE_PROMPTS = [
  { text: "Create a SWOT analysis for a coffee shop", icon: LayoutGrid },
  { text: "Brainstorm 5 startup ideas on sticky notes", icon: StickyNote },
  { text: "Make a pros and cons list for remote work", icon: ArrowRightLeft },
  { text: "Design a user journey map", icon: Lightbulb },
  { text: "Build a weekly sprint board", icon: ListChecks },
  { text: "Organize everything into a neat grid", icon: LayoutGrid },
  { text: "Generate an architecture diagram", icon: GitBranch, slashPrefill: "/arch-diagram " },
];

// ── Slash commands ──────────────────────────────────────────────────
const SLASH_COMMANDS = [
  {
    command: "/arch-diagram",
    description: "Generate an architecture diagram from a GitHub repo",
    icon: GitBranch,
  },
  {
    command: "/brainstorm",
    description: "Mind map — brainstorm ideas around a topic",
    icon: Lightbulb,
  },
  {
    command: "/flowchart",
    description: "Multi-step process with branching paths",
    icon: ArrowRightLeft,
  },
];

interface AIChatPanelProps {
  boardId: string;
  uid: string;
  open: boolean;
}

export default function AIChatPanel({ boardId, uid, open }: AIChatPanelProps) {
  const [command, setCommand] = useState("");
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const setAIPanelOpen = useUIStore((s) => s.setAIPanelOpen);

  const { submitCommand, loading, statusMessage, error, messages, clearError } = useAIAgent(
    boardId,
    uid
  );

  // Filter slash commands based on current input
  const filteredCommands = command.startsWith("/")
    ? SLASH_COMMANDS.filter((c) => c.command.startsWith(command.split(" ")[0].toLowerCase()))
    : [];

  // Show menu when typing / and there are matches (and no space yet = haven't picked a command)
  useEffect(() => {
    const isTypingSlash = command.startsWith("/") && !command.includes(" ");
    setSlashMenuOpen(isTypingSlash && filteredCommands.length > 0);
    setSlashMenuIndex(0);
  }, [command, filteredCommands.length]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  const selectSlashCommand = useCallback((cmd: string) => {
    setCommand(cmd + " ");
    setSlashMenuOpen(false);
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    async (text?: string) => {
      const cmd = text ?? command;
      if (!cmd.trim() || loading) return;
      setCommand("");
      setSlashMenuOpen(false);
      await submitCommand(cmd);
    },
    [command, loading, submitCommand]
  );

  const handleExampleClick = useCallback(
    async (prompt: { text: string; slashPrefill?: string }) => {
      if (prompt.slashPrefill) {
        setCommand(prompt.slashPrefill);
        await addChatMessage(boardId, uid, {
          role: "assistant",
          content:
            "Please share the repo URL and I'll get started! e.g.\n/arch-diagram https://github.com/owner/repo",
          timestamp: null,
        });
        // Focus and move cursor to end (after React re-renders the value)
        setTimeout(() => {
          const el = inputRef.current;
          if (el) {
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
          }
        }, 0);
        return;
      }
      handleSubmit(prompt.text);
    },
    [boardId, uid, handleSubmit]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (slashMenuOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSlashMenuIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSlashMenuIndex((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === "Tab" || e.key === "Enter") {
          e.preventDefault();
          selectSlashCommand(filteredCommands[slashMenuIndex].command);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setSlashMenuOpen(false);
          return;
        }
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape") {
        setAIPanelOpen(false);
      }
      e.stopPropagation();
    },
    [
      handleSubmit,
      setAIPanelOpen,
      slashMenuOpen,
      filteredCommands,
      slashMenuIndex,
      selectSlashCommand,
    ]
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 z-40 bg-black/5 transition-opacity duration-300 dark:bg-black/20",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setAIPanelOpen(false)}
      />

      {/* Panel */}
      <aside
        className={cn(
          "absolute top-0 right-0 z-50 flex h-full w-80 flex-col",
          "border-l border-zinc-200/60 bg-white/98 shadow-2xl backdrop-blur-xl",
          "dark:border-zinc-700/60 dark:bg-zinc-900/98 dark:shadow-black/40",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
              <Wand2 className="size-3.5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Copilot</p>
            </div>
          </div>
          <button
            onClick={() => setAIPanelOpen(false)}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-zinc-200 to-transparent dark:via-zinc-700" />

        {/* Messages */}
        <div
          ref={scrollRef}
          className="scrollbar-thin flex-1 overflow-y-auto overscroll-contain px-4 py-3"
        >
          {messages.length === 0 && !loading && <EmptyState onExampleClick={handleExampleClick} />}

          <div className="space-y-3">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {loading && (
              <div className="flex items-start gap-2.5 py-1">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40">
                  <Sparkles className="size-3 text-violet-500" />
                </div>
                <div className="flex items-center gap-2 pt-1 text-xs text-zinc-500">
                  <Loader2 className="size-3 animate-spin" />
                  <span className="whitespace-pre-line">{statusMessage || "Working on it..."}</span>
                </div>
              </div>
            )}

            {error && !loading && (
              <div className="rounded-xl border border-red-200/60 bg-red-50/50 px-3 py-2.5 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="relative px-4 pb-4 pt-2">
          {/* Slash command menu */}
          {slashMenuOpen && (
            <div className="absolute bottom-full left-4 right-4 mb-1 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Commands
              </div>
              {filteredCommands.map((cmd, i) => {
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.command}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectSlashCommand(cmd.command);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                      i === slashMenuIndex
                        ? "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                        : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    )}
                  >
                    <Icon className="size-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" />
                    <div className="min-w-0">
                      <span className="font-medium">{cmd.command}</span>
                      <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">
                        {cmd.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex gap-2 rounded-xl border border-zinc-200 bg-zinc-50/50 p-1.5 shadow-sm transition-colors focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-800/50 dark:focus-within:border-violet-600/50">
            <input
              ref={inputRef}
              value={command}
              onChange={(e) => {
                setCommand(e.target.value);
                if (error) clearError();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type / for commands or ask anything..."
              disabled={loading}
              className={cn(
                "flex h-8 w-full bg-transparent px-2 text-sm outline-none",
                "placeholder:text-zinc-400",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "dark:placeholder:text-zinc-500"
              )}
            />
            <Button
              size="icon"
              onClick={() => handleSubmit()}
              disabled={loading || !command.trim()}
              className="size-8 shrink-0 rounded-lg bg-violet-600 shadow-sm hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-700"
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

/** Render inline markdown: **bold** and `code` */
function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded bg-zinc-200/60 px-1 py-0.5 text-[0.85em] dark:bg-zinc-700/60"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-violet-600 px-3.5 py-2 text-sm text-white shadow-sm">
          <p className="whitespace-pre-wrap wrap-break-word">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40">
        <Sparkles className="size-3 text-violet-500" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-md bg-zinc-100 px-3.5 py-2 text-sm text-zinc-800 shadow-sm dark:bg-zinc-800 dark:text-zinc-200">
          <p className="whitespace-pre-wrap wrap-break-word">
            {renderInlineMarkdown(message.content)}
          </p>
        </div>
        {message.operationCount != null && message.operationCount > 0 && (
          <div className="mt-1 ml-1 flex items-center gap-1 text-[10px] font-medium text-violet-500/80">
            <Zap className="size-2.5" />
            {message.operationCount} operation{message.operationCount !== 1 ? "s" : ""} applied
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  onExampleClick,
}: {
  onExampleClick: (prompt: { text: string; slashPrefill?: string }) => void;
}) {
  return (
    <div className="flex flex-col items-center py-6">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
        <Sparkles className="size-6 text-white" />
      </div>
      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
        What can I help you build?
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        I can create, organize, and modify your board.
      </p>
      <div className="mt-5 w-full space-y-1.5">
        {EXAMPLE_PROMPTS.map((prompt) => {
          const Icon = prompt.icon;
          return (
            <button
              key={prompt.text}
              onClick={() => onExampleClick(prompt)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12px] text-zinc-600",
                "border border-transparent transition-all",
                "hover:border-violet-200 hover:bg-violet-50/60 hover:text-violet-700 hover:shadow-sm",
                "dark:text-zinc-400",
                "dark:hover:border-violet-800/40 dark:hover:bg-violet-950/30 dark:hover:text-violet-300"
              )}
            >
              <Icon className="size-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" />
              <span>{prompt.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
