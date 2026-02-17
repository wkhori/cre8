"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, MousePointer2, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth/AuthProvider";

export default function Home() {
  const router = useRouter();
  const { user, loading, actionLoading, error, signInWithGoogle, signUpWithEmail, signInWithEmail } = useAuth();

  const [showEmail, setShowEmail] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!loading && user) {
      router.replace("/board/default");
    }
  }, [loading, router, user]);

  const busy = loading || actionLoading;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950 text-zinc-100">
      {/* ── Ambient glow layers ── */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(120,119,198,0.18),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_60%,rgba(56,189,248,0.08),transparent_50%)]" />

      {/* ── Grid pattern ── */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_31px,rgba(255,255,255,0.03)_32px),linear-gradient(90deg,transparent_31px,rgba(255,255,255,0.03)_32px)] bg-size-[32px_32px]" />

      {/* ── Grid intersection dots ── */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_1px_at_32px_32px,rgba(255,255,255,0.15)_0%,transparent_100%)] bg-size-[32px_32px]" />

      {/* ── Vignette ── */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(9,9,11,0.7))]" />

      {/* ── Content ── */}
      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center px-6 py-20">
        {/* Top badge */}
        <Badge
          variant="outline"
          className="mb-8 border-zinc-700/80 bg-zinc-900/60 px-3 py-1.5 text-[11px] tracking-[0.2em] text-zinc-400 uppercase backdrop-blur-sm"
        >
          <span className="mr-2 inline-block size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
          Now in beta
        </Badge>

        {/* Headline */}
        <h1 className="text-center text-[clamp(2.5rem,7vw,4.5rem)] leading-[1.04] font-semibold tracking-[-0.035em] text-white">
          Where teams think
          <br />
          <span className="bg-linear-to-r from-zinc-200 via-zinc-400 to-zinc-500 bg-clip-text text-transparent">
            out loud.
          </span>
        </h1>

        {/* Subheadline */}
        <p className="mt-5 max-w-md text-center text-[17px] leading-relaxed text-zinc-400">
          An infinite canvas for brainstorming, planning, and building together — with AI that moves as fast as you do.
        </p>

        {/* Feature pills */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <FeaturePill icon={<MousePointer2 className="size-3" />} label="Multiplayer cursors" />
          <FeaturePill icon={<Users className="size-3" />} label="Real-time sync" />
          <FeaturePill icon={<Sparkles className="size-3" />} label="AI-powered" />
        </div>

        {/* ── Sign-in card ── */}
        <div className="mt-12 w-full max-w-sm">
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-6 shadow-[0_8px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl">
            <h2 className="text-center text-lg font-medium text-zinc-100">
              Get started
            </h2>
            <p className="mt-1.5 text-center text-sm text-zinc-500">
              Sign in to open your canvas.
            </p>

            <div className="mt-5 space-y-3">
              {/* Google — hero CTA */}
              {!showEmail && (
                <>
                  <Button
                    size="lg"
                    className="h-11 w-full justify-between rounded-xl bg-white text-zinc-950 hover:bg-zinc-100"
                    onClick={() => void signInWithGoogle()}
                    disabled={busy}
                  >
                    <span className="inline-flex items-center gap-2.5 text-[14px] font-medium">
                      <GoogleMark />
                      Continue with Google
                    </span>
                    {busy ? (
                      <Loader2 className="size-4 animate-spin text-zinc-400" />
                    ) : (
                      <ArrowRight className="size-4 text-zinc-400" />
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setShowEmail(true)}
                    className="w-full py-1.5 text-center text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                  >
                    or continue with email
                  </button>
                </>
              )}

              {/* Email form — revealed on demand */}
              {showEmail && (
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (isSignUp) {
                      void signUpWithEmail(name, email, password);
                    } else {
                      void signInWithEmail(email, password);
                    }
                  }}
                >
                  {isSignUp && (
                    <div className="space-y-1.5">
                      <Label htmlFor="auth-name" className="text-xs text-zinc-400">Name</Label>
                      <Input
                        id="auth-name"
                        type="text"
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        autoFocus
                        className="h-10 rounded-lg border-zinc-700 bg-zinc-950/60 text-sm text-zinc-100 placeholder:text-zinc-600"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="auth-email" className="text-xs text-zinc-400">Email</Label>
                    <Input
                      id="auth-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus={!isSignUp}
                      className="h-10 rounded-lg border-zinc-700 bg-zinc-950/60 text-sm text-zinc-100 placeholder:text-zinc-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="auth-password" className="text-xs text-zinc-400">Password</Label>
                    <Input
                      id="auth-password"
                      type="password"
                      placeholder={isSignUp ? "At least 6 characters" : "••••••••"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={isSignUp ? 6 : undefined}
                      className="h-10 rounded-lg border-zinc-700 bg-zinc-950/60 text-sm text-zinc-100 placeholder:text-zinc-600"
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={busy}
                    className="h-10 w-full rounded-xl bg-zinc-100 text-sm font-medium text-zinc-900 hover:bg-white"
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : isSignUp ? "Create Account" : "Sign In"}
                  </Button>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => { setShowEmail(false); setIsSignUp(false); }}
                      className="text-xs text-zinc-600 transition-colors hover:text-zinc-400"
                    >
                      Back to Google
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSignUp(!isSignUp)}
                      className="text-xs text-zinc-400 transition-colors hover:text-zinc-200"
                    >
                      {isSignUp ? "Have an account? Sign in" : "Need an account? Sign up"}
                    </button>
                  </div>
                </form>
              )}

              {error && (
                <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-center text-xs text-red-300">
                  {error}
                </p>
              )}
            </div>
          </div>

          {/* Trust line */}
          <p className="mt-4 text-center text-[11px] text-zinc-600">
            Free to use. No credit card required.
          </p>
        </div>
      </div>

      {/* ── Bottom logo mark ── */}
      <div className="absolute bottom-6 flex items-center gap-1.5 text-zinc-700">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="text-zinc-600"
        >
          <rect width="7" height="7" rx="1.5" fill="currentColor" />
          <rect x="9" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.5" />
          <rect y="9" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.5" />
          <rect x="9" y="9" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.3" />
        </svg>
        <span className="text-xs font-medium tracking-tight">cre8</span>
      </div>
    </div>
  );
}

/* ── Supporting components ── */

function FeaturePill({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800/80 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-400 backdrop-blur-sm">
      {icon}
      {label}
    </span>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8A6 6 0 1 1 12 6a5.3 5.3 0 0 1 3.8 1.5l2.6-2.5A9.1 9.1 0 0 0 12 2.5a9.5 9.5 0 1 0 0 19c5.5 0 9.2-3.9 9.2-9.3 0-.6-.1-1.1-.2-1.6H12Z"
      />
      <path
        fill="#34A853"
        d="M3.8 7.5 7 9.8A6 6 0 0 1 12 6c1.5 0 2.8.5 3.8 1.5l2.6-2.5A9.2 9.2 0 0 0 12 2.5a9.5 9.5 0 0 0-8.2 5Z"
        opacity=".8"
      />
      <path
        fill="#FBBC05"
        d="M12 21.5c2.4 0 4.5-.8 6-2.3l-2.8-2.2c-.8.5-1.9.9-3.2.9-3.8 0-5.2-2.5-5.5-3.8l-3.2 2.5a9.5 9.5 0 0 0 8.7 4.9Z"
        opacity=".8"
      />
      <path
        fill="#4285F4"
        d="M21.2 12.2c0-.6-.1-1.1-.2-1.6H12v3.9h5.5a4.9 4.9 0 0 1-2.3 3.2l2.8 2.2c1.6-1.5 3.2-3.9 3.2-7.7Z"
      />
    </svg>
  );
}
