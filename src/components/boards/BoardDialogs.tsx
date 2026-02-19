"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BoardDoc } from "@/lib/sync";
import { toast } from "sonner";

// ── Create Board Dialog ──────────────────────────────────────────────

interface CreateBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => Promise<void>;
}

export function CreateBoardDialog({ open, onOpenChange, onCreate }: CreateBoardDialogProps) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setSubmitting(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onCreate(trimmed);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create new board</DialogTitle>
          <DialogDescription>Give your board a name to get started.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="board-name">Board name</Label>
          <Input
            ref={inputRef}
            id="board-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="My awesome board"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || submitting}>
            {submitting ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Rename Board Dialog ──────────────────────────────────────────────

interface RenameBoardDialogProps {
  board: BoardDoc | null;
  onOpenChange: (open: boolean) => void;
  onRename: (boardId: string, newName: string) => Promise<void>;
}

export function RenameBoardDialog({ board, onOpenChange, onRename }: RenameBoardDialogProps) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (board) {
      setName(board.name);
      setSubmitting(false);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [board]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed || !board || submitting) return;
    setSubmitting(true);
    try {
      await onRename(board.id, trimmed);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!board} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename board</DialogTitle>
          <DialogDescription>Enter a new name for this board.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="rename-board">Board name</Label>
          <Input
            ref={inputRef}
            id="rename-board"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || submitting}>
            {submitting ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete Board Dialog ──────────────────────────────────────────────

interface DeleteBoardDialogProps {
  board: BoardDoc | null;
  onOpenChange: (open: boolean) => void;
  onDelete: (boardId: string) => Promise<void>;
}

export function DeleteBoardDialog({ board, onOpenChange, onDelete }: DeleteBoardDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (board) setSubmitting(false);
  }, [board]);

  const handleDelete = async () => {
    if (!board || submitting) return;
    setSubmitting(true);
    try {
      await onDelete(board.id);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!board} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{board?.name}&rdquo;?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. All shapes and data on this board will be permanently
            deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Share Board Dialog ───────────────────────────────────────────────

interface ShareBoardDialogProps {
  board: BoardDoc | null;
  onOpenChange: (open: boolean) => void;
}

export function ShareBoardDialog({ board, onOpenChange }: ShareBoardDialogProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl =
    typeof window !== "undefined" && board ? `${window.location.origin}/board/${board.id}` : "";

  useEffect(() => {
    if (board) setCopied(false);
  }, [board]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <Dialog open={!!board} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share board</DialogTitle>
          <DialogDescription>Anyone with this link can view and edit this board.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            value={shareUrl}
            readOnly
            className="flex-1"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <Button onClick={handleCopy} variant="outline" className="shrink-0">
            {copied ? (
              <Check className="mr-2 size-3.5 text-emerald-500" />
            ) : (
              <Copy className="mr-2 size-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
