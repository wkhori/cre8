"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useTheme } from "next-themes";
import {
  Plus,
  Loader2,
  LogOut,
  Moon,
  ArrowDownAZ,
  Clock,
  CalendarPlus,
  LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  listUserBoards,
  listFavoritedBoards,
  createBoard,
  updateBoard,
  deleteBoard,
  duplicateBoard,
  toggleFavorite,
  type BoardDoc,
  type BoardOwner,
} from "@/lib/sync";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BoardCard from "@/components/boards/BoardCard";
import { DeleteBoardDialog } from "@/components/boards/BoardDialogs";
import { getTimestamp, randomBoardName } from "@/lib/board-utils";

type SortBy = "recent" | "name" | "created";
type Filter = "all" | "favorites";

export default function BoardsPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, actionLoading, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  const [boards, setBoards] = useState<BoardDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("recent");

  // Dialog states — only delete still needs confirmation
  const [deleteTarget, setDeleteTarget] = useState<BoardDoc | null>(null);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
    }
  }, [authLoading, user, router]);

  // Fetch boards
  const fetchBoards = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        listUserBoards(user.uid),
        listFavoritedBoards(user.uid),
      ]);
      const owned = results[0].status === "fulfilled" ? results[0].value : [];
      const favorited = results[1].status === "fulfilled" ? results[1].value : [];
      // Merge and deduplicate (owned wins over favorited for same board)
      const map = new Map<string, BoardDoc>();
      for (const b of favorited) map.set(b.id, b);
      for (const b of owned) map.set(b.id, b);
      setBoards(Array.from(map.values()));
    } catch (err) {
      console.error("Failed to load boards:", err);
      toast.error("Failed to load boards");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchBoards();
  }, [user, fetchBoards]);

  // Filter + sort
  const filteredBoards = useMemo(() => {
    let result = boards;
    if (filter === "favorites" && user) {
      result = result.filter((b) => (b.favoriteOf ?? []).includes(user.uid));
    }
    return [...result].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "created":
          return getTimestamp(b.createdAt) - getTimestamp(a.createdAt);
        case "recent":
        default:
          return getTimestamp(b.updatedAt) - getTimestamp(a.updatedAt);
      }
    });
  }, [boards, filter, sortBy, user]);

  // Owner helper
  const getOwner = useCallback(
    (): BoardOwner => ({
      uid: user!.uid,
      name: profile?.name ?? user!.displayName ?? "Creator",
      photoURL: profile?.photoURL ?? user!.photoURL ?? null,
    }),
    [user, profile]
  );

  // Action handlers
  const handleCreateInstant = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const name = randomBoardName();
      const board = await createBoard(name, getOwner());
      router.push(`/board/${board.id}`);
    } catch (err) {
      console.error("Failed to create board:", err);
      toast.error("Failed to create board");
      setCreating(false);
    }
  };

  const handleRename = async (boardId: string, newName: string) => {
    try {
      await updateBoard(boardId, { name: newName });
      setBoards((prev) => prev.map((b) => (b.id === boardId ? { ...b, name: newName } : b)));
      toast.success("Board renamed");
    } catch (err) {
      console.error("Failed to rename board:", err);
      toast.error("Failed to rename board");
    }
  };

  const handleDelete = async (boardId: string) => {
    try {
      await deleteBoard(boardId);
      setBoards((prev) => prev.filter((b) => b.id !== boardId));
      toast.success("Board deleted");
    } catch (err) {
      console.error("Failed to delete board:", err);
      toast.error("Failed to delete board");
    }
  };

  const handleDuplicate = async (board: BoardDoc) => {
    try {
      const newBoard = await duplicateBoard(board.id, `${board.name} (copy)`, getOwner());
      toast.success("Board duplicated");
      router.push(`/board/${newBoard.id}`);
    } catch (err) {
      console.error("Failed to duplicate board:", err);
      toast.error("Failed to duplicate board");
    }
  };

  const handleToggleFavorite = async (board: BoardDoc) => {
    const isFav = (board.favoriteOf ?? []).includes(user!.uid);
    try {
      await toggleFavorite(board.id, user!.uid, isFav);
      setBoards((prev) =>
        prev.map((b) => {
          if (b.id !== board.id) return b;
          const favs = b.favoriteOf ?? [];
          return {
            ...b,
            favoriteOf: isFav ? favs.filter((uid) => uid !== user!.uid) : [...favs, user!.uid],
          };
        })
      );
    } catch (err) {
      console.error("Failed to update favorite:", err);
      toast.error("Failed to update favorite");
    }
  };

  // Loading / auth states
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  const sortLabel = sortBy === "recent" ? "Recent" : sortBy === "name" ? "Name" : "Created";
  const SortIcon = sortBy === "recent" ? Clock : sortBy === "name" ? ArrowDownAZ : CalendarPlus;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/90 backdrop-blur-lg dark:border-zinc-800/80 dark:bg-zinc-950/90">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Image
              src={theme === "dark" ? "/logo-dark.svg" : "/logo-light.svg"}
              alt="cre8"
              width={24}
              height={24}
              className="rounded-lg"
            />
            <span className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              cre8
            </span>
          </div>

          <div className="flex-1" />

          {/* New board button — instant create */}
          <Button size="sm" onClick={handleCreateInstant} disabled={creating}>
            {creating ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Plus className="mr-1.5 size-3.5" />
            )}
            New board
          </Button>

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {profile?.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.photoURL}
                    alt={profile.name}
                    className="size-8 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-700"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex size-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
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
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Title + filters row */}
        <div className="mb-6 flex items-center gap-4">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">My Boards</h1>
          <div className="flex-1" />
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="favorites">Favorites</TabsTrigger>
            </TabsList>
          </Tabs>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <SortIcon className="mr-1.5 size-3.5" />
                {sortLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSortBy("recent")}>
                <Clock className="mr-2 size-3.5" />
                Recent
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("name")}>
                <ArrowDownAZ className="mr-2 size-3.5" />
                Name
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("created")}>
                <CalendarPlus className="mr-2 size-3.5" />
                Created
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Board grid */}
        {loading ? (
          // Skeleton loading
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-800/80"
              >
                <div className="h-36 animate-pulse bg-zinc-200 dark:bg-zinc-800" />
                <div className="space-y-2 px-3 py-2.5">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredBoards.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
              <LayoutGrid className="size-7 text-zinc-400" />
            </div>
            <h2 className="mb-1 text-lg font-medium text-zinc-900 dark:text-zinc-100">
              {filter === "favorites" ? "No favorites yet" : "No boards yet"}
            </h2>
            <p className="mb-6 max-w-sm text-sm text-muted-foreground">
              {filter === "favorites"
                ? "Star a board to add it to your favorites for quick access."
                : "Create your first board to start collaborating with your team."}
            </p>
            {filter === "all" && (
              <Button onClick={handleCreateInstant} disabled={creating}>
                {creating ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Plus className="mr-1.5 size-3.5" />
                )}
                Create your first board
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {/* Create new card */}
            <button
              onClick={handleCreateInstant}
              disabled={creating}
              className="flex h-full min-h-50 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-white/50 text-zinc-500 transition-all duration-200 hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 active:scale-[0.98] disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-500 dark:hover:border-zinc-600 dark:hover:bg-zinc-900/50 dark:hover:text-zinc-300"
            >
              {creating ? <Loader2 className="size-6 animate-spin" /> : <Plus className="size-6" />}
              <span className="text-sm font-medium">New board</span>
            </button>

            {filteredBoards.map((board) => (
              <BoardCard
                key={board.id}
                board={board}
                currentUserId={user.uid}
                onRename={handleRename}
                onDelete={setDeleteTarget}
                onDuplicate={handleDuplicate}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        )}
      </main>

      {/* Only delete needs a confirmation dialog */}
      <DeleteBoardDialog
        board={deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        onDelete={handleDelete}
      />
    </div>
  );
}
