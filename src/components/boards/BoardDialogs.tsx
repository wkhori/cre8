"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { BoardDoc } from "@/lib/sync";

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
