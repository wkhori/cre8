"use client";

import { useEffect, useState } from "react";
import { subscribePresence, type PresenceUser } from "@/lib/presence";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PresenceBarProps {
  boardId: string;
  myUid: string;
}

export default function PresenceBar({ boardId, myUid }: PresenceBarProps) {
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    const unsubscribe = subscribePresence(boardId, (allUsers) => {
      // Show online users, with current user first
      const online = allUsers
        .filter((u) => u.online)
        .sort((a, b) => {
          if (a.uid === myUid) return -1;
          if (b.uid === myUid) return 1;
          return a.displayName.localeCompare(b.displayName);
        });
      setUsers(online);
    });
    return unsubscribe;
  }, [boardId, myUid]);

  if (users.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1">
        {/* Stacked avatars */}
        <div className="flex -space-x-2">
          {users.slice(0, 8).map((user) => (
            <Tooltip key={user.uid}>
              <TooltipTrigger asChild>
                <div
                  className="relative flex size-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white dark:border-zinc-950"
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
                        // Hide broken image, show initial letter behind it
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : null}
                  {/* Initial letter (visible as fallback when no photo or photo fails) */}
                  {!user.photoURL && user.displayName.slice(0, 1).toUpperCase()}
                  {/* Online dot */}
                  <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-white bg-green-500 dark:border-zinc-950" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {user.uid === myUid ? `${user.displayName} (you)` : user.displayName}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        {users.length > 8 && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            +{users.length - 8}
          </span>
        )}
        <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-400">
          {users.length} online
        </span>
      </div>
    </TooltipProvider>
  );
}
