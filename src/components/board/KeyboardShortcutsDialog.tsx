"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
const MOD = isMac ? "\u2318" : "Ctrl";

interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutCategory {
  label: string;
  shortcuts: Shortcut[];
}

const SHORTCUTS: ShortcutCategory[] = [
  {
    label: "Tools",
    shortcuts: [
      { keys: ["V"], description: "Pointer tool" },
      { keys: ["H"], description: "Hand tool" },
      { keys: ["Space"], description: "Temporary pan (hold)" },
      { keys: ["R"], description: "Rectangle" },
      { keys: ["O"], description: "Circle" },
      { keys: ["T"], description: "Text" },
      { keys: ["S"], description: "Sticky note" },
      { keys: ["F"], description: "Frame" },
      { keys: ["C"], description: "Connector" },
    ],
  },
  {
    label: "Edit",
    shortcuts: [
      { keys: [MOD, "Z"], description: "Undo" },
      { keys: [MOD, "\u21e7", "Z"], description: "Redo" },
      { keys: [MOD, "C"], description: "Copy" },
      { keys: [MOD, "V"], description: "Paste" },
      { keys: [MOD, "D"], description: "Duplicate" },
      { keys: ["\u232b"], description: "Delete selected" },
      { keys: [MOD, "A"], description: "Select all" },
    ],
  },
  {
    label: "Arrange",
    shortcuts: [
      { keys: [MOD, "]"], description: "Bring to front" },
      { keys: [MOD, "["], description: "Send to back" },
      { keys: ["\u2190", "\u2191", "\u2192", "\u2193"], description: "Nudge 1px" },
      { keys: ["\u21e7", "\u2190", "\u2191", "\u2192", "\u2193"], description: "Nudge 10px" },
    ],
  },
  {
    label: "View",
    shortcuts: [
      { keys: [MOD, "+"], description: "Zoom in" },
      { keys: [MOD, "\u2212"], description: "Zoom out" },
      { keys: [MOD, "0"], description: "Reset zoom" },
      { keys: [MOD, "1"], description: "Fit to content" },
      { keys: ["Esc"], description: "Deselect / cancel tool" },
      { keys: ["?"], description: "Show shortcuts" },
    ],
  },
];

function Keycap({ label }: { label: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 select-none items-center justify-center rounded-[5px] border border-zinc-300 bg-zinc-100 px-1.5 font-mono text-[11px] font-medium text-zinc-600 shadow-[0_1px_0_1px_rgba(0,0,0,0.08)] dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:shadow-[0_1px_0_1px_rgba(0,0,0,0.4)]">
      {label}
    </kbd>
  );
}

function ShortcutRow({ shortcut }: { shortcut: Shortcut }) {
  return (
    <div className="group flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40">
      <span className="text-[13px] text-zinc-500 transition-colors group-hover:text-zinc-700 dark:text-zinc-400 dark:group-hover:text-zinc-300">
        {shortcut.description}
      </span>
      <div className="flex items-center gap-1">
        {shortcut.keys.map((key, i) => (
          <Keycap key={i} label={key} />
        ))}
      </div>
    </div>
  );
}

export default function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-base">Keyboard shortcuts</DialogTitle>
          <DialogDescription className="sr-only">
            Reference for all keyboard shortcuts available on the canvas.
          </DialogDescription>
        </DialogHeader>

        {/* Shortcuts list */}
        <div className="max-h-[60vh] overflow-y-auto px-2 pb-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-200 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700">
          {SHORTCUTS.map((category, ci) => (
            <div key={category.label}>
              <div className="flex items-center gap-2.5 px-2 pt-3 pb-1">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  {category.label}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              {category.shortcuts.map((shortcut) => (
                <ShortcutRow key={shortcut.description} shortcut={shortcut} />
              ))}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border px-4 py-2.5 text-center text-[11px] text-muted-foreground">
          Press <Keycap label="?" /> anywhere to toggle this dialog
        </div>
      </DialogContent>
    </Dialog>
  );
}
