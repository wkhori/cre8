"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Star,
  MoreHorizontal,
  Pencil,
  Copy,
  Link,
  Trash2,
  ExternalLink,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BoardDoc } from "@/lib/sync";
import { timeAgo } from "@/lib/utils";
import { pickGradient, getTimestamp } from "@/lib/board-utils";

interface BoardCardProps {
  board: BoardDoc;
  currentUserId: string;
  onRename: (boardId: string, newName: string) => Promise<void>;
  onDelete: (board: BoardDoc) => void;
  onDuplicate: (board: BoardDoc) => void;
  onToggleFavorite: (board: BoardDoc) => void;
}

export default function BoardCard({
  board,
  currentUserId,
  onRename,
  onDelete,
  onDuplicate,
  onToggleFavorite,
}: BoardCardProps) {
  const router = useRouter();
  const isFavorited = (board.favoriteOf ?? []).includes(currentUserId);
  const gradient = pickGradient(board.id);
  const edited = timeAgo(getTimestamp(board.updatedAt));

  // Inline rename state
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(board.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Copy link state
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const saveRename = async () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== board.name) {
      try {
        await onRename(board.id, trimmed);
      } catch {
        setEditValue(board.name);
      }
    } else {
      setEditValue(board.name);
    }
    setEditing(false);
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/board/${board.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <div
      className="group cursor-pointer overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm transition-all duration-200 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800/80 dark:bg-zinc-900/50 dark:hover:border-zinc-700"
      onClick={() => !editing && router.push(`/board/${board.id}`)}
    >
      {/* Preview area */}
      <div className={`relative h-36 bg-linear-to-br ${gradient}`}>
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />

        {/* Favorite button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(board);
          }}
          className="absolute right-2 top-2 rounded-md p-1 transition-all duration-150 hover:bg-black/10 hover:scale-110 dark:hover:bg-white/10"
          title={isFavorited ? "Remove from favorites" : "Add to favorites"}
        >
          <Star
            className={`size-4 transition-all duration-150 ${
              isFavorited
                ? "fill-amber-400 text-amber-400"
                : "text-zinc-400 opacity-0 group-hover:opacity-100"
            }`}
          />
        </button>
      </div>

      {/* Info area */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveRename();
                if (e.key === "Escape") {
                  setEditValue(board.name);
                  setEditing(false);
                }
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-5 w-full rounded border border-zinc-300 bg-transparent px-1 text-sm font-medium text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-600 dark:text-zinc-100 dark:focus:border-zinc-400"
            />
          ) : (
            <p
              className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditValue(board.name);
                setEditing(true);
              }}
              title="Double-click to rename"
            >
              {board.name}
            </p>
          )}
          <p className="text-xs text-muted-foreground">Edited {edited}</p>
        </div>

        {/* 3-dot menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon-xs"
              variant="ghost"
              className="shrink-0 opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => router.push(`/board/${board.id}`)}>
              <ExternalLink className="mr-2 size-3.5" />
              Open
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setEditValue(board.name);
                setEditing(true);
              }}
            >
              <Pencil className="mr-2 size-3.5" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(board)}>
              <Copy className="mr-2 size-3.5" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyLink}>
              {copied ? (
                <Check className="mr-2 size-3.5 text-emerald-500" />
              ) : (
                <Link className="mr-2 size-3.5" />
              )}
              {copied ? "Copied!" : "Copy link"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(board)}>
              <Trash2 className="mr-2 size-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
