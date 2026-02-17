"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth/AuthProvider";

export default function Home() {
  const router = useRouter();
  const { user, profile, loading, actionLoading, error, signInWithGoogle } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/board/default");
    }
  }, [loading, router, user]);

  const busy = loading || actionLoading;

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.22),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(251,146,60,0.2),transparent_30%),radial-gradient(circle_at_50%_78%,rgba(20,184,166,0.18),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_31px,rgba(255,255,255,0.05)_32px),linear-gradient(90deg,transparent_31px,rgba(255,255,255,0.05)_32px)] bg-[size:32px_32px]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-16">
        <div className="grid w-full gap-10 lg:grid-cols-[1.3fr_1fr]">
          <section className="space-y-7">
            <Badge
              variant="outline"
              className="border-cyan-300/45 bg-cyan-400/8 px-3 py-1 text-xs tracking-[0.18em] text-cyan-100 uppercase"
            >
              Collaborative Whiteboard + AI
            </Badge>

            <h1 className="max-w-3xl text-5xl leading-[0.96] font-semibold tracking-tight text-zinc-50 md:text-7xl">
              Build together on one shared canvas.
            </h1>

            <p className="max-w-2xl text-lg text-zinc-300 md:text-xl">
              Sign in to enter <span className="font-semibold text-zinc-100">cre8</span> and
              collaborate in real time with authenticated user identity and profile-backed names.
            </p>

            <div className="grid max-w-2xl gap-3 text-sm text-zinc-300 sm:grid-cols-3">
              <Insight title="Live Cursors" desc="Presence + pointer sync" />
              <Insight title="Shared Objects" desc="One source of truth" />
              <Insight title="AI Commands" desc="Function-called edits" />
            </div>
          </section>

          <aside className="rounded-2xl border border-zinc-700/70 bg-zinc-900/70 p-6 shadow-[0_24px_80px_rgba(8,145,178,0.15)] backdrop-blur-xl">
            <div className="space-y-2">
              <p className="text-xs tracking-[0.2em] text-zinc-400 uppercase">Access</p>
              <h2 className="text-2xl font-semibold text-zinc-50">Sign in to continue</h2>
              <p className="text-sm text-zinc-400">
                We create/read your profile in Firestore and use your name for multiplayer presence.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <Button
                size="lg"
                className="w-full justify-between bg-zinc-50 text-zinc-950 hover:bg-zinc-200"
                onClick={() => void signInWithGoogle()}
                disabled={busy}
              >
                <span className="inline-flex items-center gap-2">
                  <GoogleMark />
                  Continue with Google
                </span>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              </Button>

              <div className="rounded-lg border border-zinc-700 bg-zinc-950/70 p-3 text-xs text-zinc-400">
                {profile ? (
                  <span>
                    Signed in as <span className="font-medium text-zinc-200">{profile.name}</span>
                  </span>
                ) : (
                  <span>Google sign-in is enabled. Profiles are synced on successful auth.</span>
                )}
              </div>

              {error && (
                <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {error}
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Insight({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-lg border border-zinc-800/90 bg-zinc-900/80 p-3">
      <p className="text-sm font-semibold text-zinc-100">{title}</p>
      <p className="text-xs text-zinc-400">{desc}</p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8A6 6 0 1 1 12 6a5.3 5.3 0 0 1 3.8 1.5l2.6-2.5A9.1 9.1 0 0 0 12 2.5a9.5 9.5 0 1 0 0 19c5.5 0 9.2-3.9 9.2-9.3 0-.6-.1-1.1-.2-1.6H12Z" />
      <path fill="#34A853" d="M3.8 7.5 7 9.8A6 6 0 0 1 12 6c1.5 0 2.8.5 3.8 1.5l2.6-2.5A9.2 9.2 0 0 0 12 2.5a9.5 9.5 0 0 0-8.2 5Z" opacity=".8" />
      <path fill="#FBBC05" d="M12 21.5c2.4 0 4.5-.8 6-2.3l-2.8-2.2c-.8.5-1.9.9-3.2.9-3.8 0-5.2-2.5-5.5-3.8l-3.2 2.5a9.5 9.5 0 0 0 8.7 4.9Z" opacity=".8" />
      <path fill="#4285F4" d="M21.2 12.2c0-.6-.1-1.1-.2-1.6H12v3.9h5.5a4.9 4.9 0 0 1-2.3 3.2l2.8 2.2c1.6-1.5 3.2-3.9 3.2-7.7Z" />
    </svg>
  );
}
