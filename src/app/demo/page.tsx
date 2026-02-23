"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { createBoard } from "@/lib/sync";

/**
 * /demo — auto signs in anonymously (if needed), creates a fresh board,
 * then redirects to /board/{newId}.
 * Each visitor gets their own clean canvas.
 */
export default function DemoPage() {
  const router = useRouter();
  const { user, loading, signInAnonymously } = useAuth();
  const attemptedRef = useRef(false);
  const creatingRef = useRef(false);

  useEffect(() => {
    if (loading) return;

    // Not signed in yet — sign in anonymously once
    if (!user) {
      if (!attemptedRef.current) {
        attemptedRef.current = true;
        void signInAnonymously();
      }
      return;
    }

    // Signed in — create a fresh demo board and redirect
    if (!creatingRef.current) {
      creatingRef.current = true;
      const owner = {
        uid: user.uid,
        name: user.displayName || "Guest",
        photoURL: user.photoURL,
      };
      void createBoard("Demo Board", owner).then((board) => {
        router.replace(`/board/${board.id}`);
      });
    }
  }, [loading, user, router, signInAnonymously]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-6 animate-spin text-zinc-600" />
        <p className="text-sm text-zinc-500">Launching demo board&hellip;</p>
      </div>
    </div>
  );
}
