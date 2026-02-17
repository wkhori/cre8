"use client";

import { useEffect, useState } from "react";
import { subscribePresence, type PresenceUser } from "@/lib/presence";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { shortName } from "@/lib/utils";

interface PresenceBarProps {
  boardId: string;
  myUid: string;
}

export default function PresenceBar({ boardId, myUid }: PresenceBarProps) {
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    const unsubscribe = subscribePresence(boardId, (allUsers) => {
      const online = allUsers
        .filter((u) => u.online && u.uid !== myUid)
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
      setUsers(online);
    });
    return unsubscribe;
  }, [boardId, myUid]);

  if (users.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1">
        <div className="flex -space-x-1.5">
          {users.slice(0, 5).map((user) => (
            <Tooltip key={user.uid}>
              <TooltipTrigger asChild>
                <div
                  className="relative flex size-6 items-center justify-center rounded-full text-[9px] font-semibold text-white ring-2 ring-white dark:ring-zinc-950"
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
                {shortName(user.displayName)}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        {users.length > 5 && (
          <span className="text-[11px] tabular-nums text-zinc-400">
            +{users.length - 5}
          </span>
        )}
      </div>
    </TooltipProvider>
  );
}
