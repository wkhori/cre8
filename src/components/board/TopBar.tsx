"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { useUIStore } from "@/store/ui-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, Pencil, Moon, Bug, LogOut, Sparkles } from "lucide-react";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import KeyboardShortcutsDialog from "@/components/board/KeyboardShortcutsDialog";

const PresenceBar = dynamic(() => import("@/components/presence/PresenceBar"), { ssr: false });

function InlineBoardName({
  name,
  onSave,
}: {
  name: string;
  onSave: (name: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(name);
  }, [name]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const save = async () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) {
      try {
        await onSave(trimmed);
      } catch {
        setValue(name);
      }
    } else {
      setValue(name);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setValue(name);
            setEditing(false);
          }
          e.stopPropagation();
        }}
        className="h-6 w-40 rounded border border-zinc-300 bg-transparent px-1.5 text-sm font-medium text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-600 dark:text-zinc-100 dark:focus:border-zinc-400"
      />
    );
  }

  if (!name) {
    return <span className="h-5 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />;
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group/name flex items-center gap-1 rounded px-1 py-0.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
      title="Click to rename"
    >
      <span className="max-w-40 truncate">{name}</span>
      <Pencil className="size-3 opacity-0 group-hover/name:opacity-50" />
    </button>
  );
}

interface TopBarProps {
  boardId: string;
  boardName: string;
  onBoardNameChange: (name: string) => Promise<void>;
  user: User;
  profile: { name: string; photoURL: string | null };
  boardReady: boolean;
  showDebug: boolean;
  setShowDebug: (v: boolean) => void;
  actionLoading: boolean;
  signOut: () => Promise<void>;
}

export default function TopBar({
  boardId,
  boardName,
  onBoardNameChange,
  user,
  profile,
  boardReady,
  showDebug,
  setShowDebug,
  actionLoading,
  signOut,
}: TopBarProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    const handler = () => setShortcutsOpen((prev) => !prev);
    window.addEventListener("toggle-shortcuts", handler);
    return () => window.removeEventListener("toggle-shortcuts", handler);
  }, []);

  const aiPanelOpen = useUIStore((s) => s.aiPanelOpen);
  const toggleAIPanel = useUIStore((s) => s.toggleAIPanel);

  return (
    <header className="sticky top-0 z-40 flex h-11 shrink-0 items-center border-b border-zinc-200/80 bg-white/90 px-3 backdrop-blur-lg dark:border-zinc-800/80 dark:bg-zinc-950/90">
      {/* Left: Back + Logo + Board name */}
      <div className="flex items-center gap-1">
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => router.push("/boards")}
          title="Back to boards"
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <Image
          src={theme === "dark" ? "/logo-dark.svg" : "/logo-light.svg"}
          alt="cre8"
          width={20}
          height={20}
          className="rounded-lg"
        />
        <InlineBoardName name={boardName} onSave={onBoardNameChange} />
      </div>

      {/* Right: Presence + AI toggle + Profile */}
      <div className="ml-auto flex items-center gap-2">
        {boardReady && <PresenceBar boardId={boardId} myUid={user.uid} />}

        <Button
          size="icon-xs"
          variant={aiPanelOpen ? "default" : "ghost"}
          onClick={toggleAIPanel}
          title="AI Agent"
          className={aiPanelOpen ? "bg-violet-600 text-white hover:bg-violet-700" : ""}
        >
          <Sparkles className="size-3.5" />
        </Button>

        <div className="mx-0.5 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />

        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {profile?.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.photoURL}
                  alt={profile.name}
                  className="size-7 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-700"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex size-7 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                  {(profile?.name ?? user.email ?? "U").slice(0, 1).toUpperCase()}
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{profile?.name ?? "User"}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <DropdownMenuSeparator />
            <div
              className="flex items-center justify-between px-2 py-1.5"
              onClick={(e) => e.preventDefault()}
            >
              <div className="flex items-center gap-2 text-sm">
                <Moon className="size-4" />
                Dark mode
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              />
            </div>
            <div
              className="flex items-center justify-between px-2 py-1.5"
              onClick={(e) => e.preventDefault()}
            >
              <div className="flex items-center gap-2 text-sm">
                <Bug className="size-4" />
                Dev mode
              </div>
              <Switch checked={showDebug} onCheckedChange={setShowDebug} />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => void signOut()}
              disabled={actionLoading}
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </header>
  );
}
