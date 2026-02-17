"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribePresence, type PresenceUser } from "@/lib/presence";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { shortName, timeAgo } from "@/lib/utils";
import { Users } from "lucide-react";

interface PresenceBarProps {
  boardId: string;
  myUid: string;
}

const STALE_MS = 60 * 1000; // 60s — if no heartbeat for this long, treat as offline

export default function PresenceBar({ boardId, myUid }: PresenceBarProps) {
  const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([]);
  const [offlineUsers, setOfflineUsers] = useState<PresenceUser[]>([]);
  const allUsersRef = useRef<PresenceUser[]>([]);

  const partition = useCallback(() => {
    const now = Date.now();
    const others = allUsersRef.current.filter((u) => u.uid !== myUid);

    const active = others
      .filter((u) => u.online && now - u.lastSeen < STALE_MS)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    const offline = others
      .filter((u) => !u.online || now - u.lastSeen >= STALE_MS)
      .sort((a, b) => b.lastSeen - a.lastSeen);

    setActiveUsers(active);
    setOfflineUsers(offline);
  }, [myUid]);

  useEffect(() => {
    const unsubscribe = subscribePresence(boardId, (allUsers) => {
      allUsersRef.current = allUsers;
      partition();
    });

    // Re-evaluate staleness every 15s so ghost sessions get caught
    const timer = setInterval(partition, 15_000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [boardId, partition]);

  const totalOthers = activeUsers.length + offlineUsers.length;
  if (totalOthers === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1 rounded-md px-1 py-0.5 outline-none transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-zinc-800">
            {activeUsers.length > 0 ? (
              <div className="flex -space-x-1.5">
                {activeUsers.slice(0, 5).map((user) => (
                  <Tooltip key={user.uid}>
                    <TooltipTrigger asChild>
                      <UserAvatar user={user} size="sm" showRing />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {shortName(user.displayName)}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            ) : (
              <Users className="size-4 text-zinc-400" />
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent align="end" side="bottom" className="w-56 p-0" sideOffset={8}>
          {activeUsers.length > 0 && (
            <div className="p-2">
              <div className="mb-1.5 flex items-center justify-between px-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Active now
                </p>
                <span className="text-[10px] tabular-nums text-zinc-400">{activeUsers.length}</span>
              </div>
              <div className="space-y-0.5">
                {activeUsers.map((user) => (
                  <UserRow key={user.uid} user={user} status="online" />
                ))}
              </div>
            </div>
          )}

          {activeUsers.length > 0 && offlineUsers.length > 0 && (
            <div className="mx-2 border-t border-zinc-200 dark:border-zinc-800" />
          )}

          {offlineUsers.length > 0 && (
            <div className="p-2">
              <div className="mb-1.5 flex items-center justify-between px-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Previously active
                </p>
                <span className="text-[10px] tabular-nums text-zinc-400">
                  {offlineUsers.length}
                </span>
              </div>
              <div className="space-y-0.5">
                {offlineUsers.slice(0, 10).map((user) => (
                  <UserRow key={user.uid} user={user} status="offline" lastSeen={user.lastSeen} />
                ))}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}

function UserAvatar({
  user,
  size,
  showRing,
}: {
  user: PresenceUser;
  size: "sm" | "md";
  showRing?: boolean;
}) {
  const sizeClass = size === "sm" ? "size-6" : "size-7";
  const textClass = size === "sm" ? "text-[9px]" : "text-[10px]";

  return (
    <div
      className={`relative flex ${sizeClass} items-center justify-center rounded-full ${textClass} font-semibold text-white ${showRing ? "ring-2 ring-white dark:ring-zinc-950" : ""}`}
      style={{ backgroundColor: user.color }}
    >
      {user.photoURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.photoURL}
          alt={user.displayName}
          className="size-full rounded-full object-cover"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : null}
      {!user.photoURL && user.displayName.slice(0, 1).toUpperCase()}
    </div>
  );
}

function UserRow({
  user,
  status,
  lastSeen,
}: {
  user: PresenceUser;
  status: "online" | "offline";
  lastSeen?: number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md px-1 py-1">
      <div className="relative">
        <UserAvatar user={user} size="md" />
        <span
          className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white dark:border-zinc-900 ${
            status === "online" ? "bg-green-500" : "bg-zinc-400"
          }`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-zinc-900 dark:text-zinc-100">
          {shortName(user.displayName)}
        </p>
        <p className="text-[10px] text-zinc-400">
          {status === "online" ? "Active now" : lastSeen ? timeAgo(lastSeen) : "Offline"}
        </p>
      </div>
    </div>
  );
}
