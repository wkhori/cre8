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
      <div className="flex items-center gap-1.5">
        <div className="flex -space-x-1.5">
          {users.slice(0, 6).map((user) => (
            <Tooltip key={user.uid}>
              <TooltipTrigger asChild>
                <div
                  className="relative flex size-6 items-center justify-center rounded-full ring-2 ring-white text-[9px] font-semibold text-white dark:ring-zinc-950"
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
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {user.uid === myUid ? `${user.displayName} (you)` : user.displayName}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        {users.length > 6 && (
          <span className="text-[11px] tabular-nums text-zinc-500">
            +{users.length - 6}
          </span>
        )}
      </div>
    </TooltipProvider>
  );
}
