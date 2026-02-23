"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Sparkles,
  GitFork,
  MessageSquareText,
  Users,
  MousePointer2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth/AuthProvider";
import { BorderTrail } from "@/components/ui/border-trail";

export default function Home() {
  const router = useRouter();
  const {
    user,
    loading,
    actionLoading,
    error,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    clearActionLoading,
  } = useAuth();

  const [showEmail, setShowEmail] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!loading && user) {
      router.replace("/boards");
    }
  }, [loading, router, user]);

  const busy = loading || actionLoading;

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100">
      {/* ── Ambient layers ── */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(120,119,198,0.12),transparent)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_80%_60%,rgba(56,189,248,0.06),transparent_50%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(transparent_31px,rgba(255,255,255,0.02)_32px),linear-gradient(90deg,transparent_31px,rgba(255,255,255,0.02)_32px)] bg-size-[32px_32px]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_1px_at_32px_32px,rgba(255,255,255,0.1)_0%,transparent_100%)] bg-size-[32px_32px]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(9,9,11,0.7))]" />

      {/* ── Nav ── */}
      <nav className="relative z-20 border-b border-zinc-800/40 bg-zinc-950/60 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <Image src="/logo-dark.svg" alt="cre8" width={18} height={18} className="opacity-70" />
            <span className="text-sm font-medium tracking-tight text-zinc-300">cre8</span>
          </div>
          <Link
            href="/dev-process"
            className="font-[family-name:var(--font-geist-mono)] text-[10px] tracking-[0.15em] text-zinc-600 uppercase transition-colors hover:text-zinc-400"
          >
            How this was built
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-12 pt-20 pb-16 lg:grid-cols-2 lg:gap-16 lg:pt-28 lg:pb-24">
          {/* Left — copy + auth */}
          <div className="flex flex-col items-center lg:items-start">
            {/* Beta badge */}
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-800/80 bg-zinc-900/60 px-3 py-1.5 text-[11px] tracking-[0.15em] text-zinc-500 uppercase backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
              Beta
            </span>

            {/* Headline */}
            <h1 className="text-center text-[clamp(2.2rem,5.5vw,3.8rem)] leading-[1.06] font-semibold tracking-[-0.035em] text-white lg:text-left">
              Your canvas has
              <br />
              <span className="bg-linear-to-r from-emerald-300 via-sky-300 to-zinc-400 bg-clip-text text-transparent">
                an AI copilot.
              </span>
            </h1>

            {/* Subheadline */}
            <p className="mt-5 max-w-md text-center text-[16px] leading-relaxed text-zinc-400 lg:text-left">
              An infinite canvas for brainstorming, planning, and building together — with an AI
              agent that creates diagrams, layouts, and frameworks from natural language.
            </p>

            {/* Feature row */}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-4 text-[12px] text-zinc-500 lg:justify-start">
              <span className="flex items-center gap-1.5">
                <MessageSquareText className="size-3.5 text-zinc-600" />
                AI canvas commands
              </span>
              <span className="flex items-center gap-1.5">
                <GitFork className="size-3.5 text-zinc-600" />
                Repo architecture diagrams
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="size-3.5 text-zinc-600" />
                Real-time multiplayer
              </span>
            </div>

            {/* Auth card */}
            <div className="mt-10 w-full max-w-sm">
              <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-6 shadow-[0_8px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl">
                <h2 className="text-left text-base font-medium text-zinc-100">Get started</h2>
                <p className="mt-1 text-left text-sm text-zinc-600">Sign in to open your canvas.</p>

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
                        onClick={() => {
                          setShowEmail(true);
                          clearActionLoading();
                        }}
                        className="w-full py-1.5 text-left text-xs text-zinc-600 transition-colors hover:text-zinc-300"
                      >
                        or continue with email
                      </button>
                    </>
                  )}

                  {/* Email form */}
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
                          <Label htmlFor="auth-name" className="text-xs text-zinc-400">
                            Name
                          </Label>
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
                        <Label htmlFor="auth-email" className="text-xs text-zinc-400">
                          Email
                        </Label>
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
                        <Label htmlFor="auth-password" className="text-xs text-zinc-400">
                          Password
                        </Label>
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
                        {busy ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : isSignUp ? (
                          "Create Account"
                        ) : (
                          "Sign In"
                        )}
                      </Button>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setShowEmail(false);
                            setIsSignUp(false);
                          }}
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
                    <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-left text-xs text-red-300">
                      {error}
                    </p>
                  )}
                </div>
              </div>
              <p className="mt-3 text-left text-[11px] text-zinc-700">
                Free to use. No credit card required.
              </p>

              {/* Try it now — border trail CTA below auth */}
              <Link
                href="/demo"
                className="relative mt-5 flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-zinc-900/80 px-6 py-3 text-sm font-medium text-zinc-100 transition-all hover:bg-zinc-800 hover:text-white"
              >
                <BorderTrail
                  size={120}
                  className="bg-linear-to-l from-emerald-400 via-sky-400 to-transparent"
                  transition={{
                    repeat: Infinity,
                    duration: 4,
                    ease: "linear",
                    repeatDelay: 0,
                  }}
                />
                <Sparkles className="size-4 text-emerald-400" />
                Try it now — no sign-up required
                <ArrowRight className="size-3.5 text-zinc-500" />
              </Link>
            </div>
          </div>

          {/* Right — product screenshot */}
          <div className="relative hidden lg:block">
            <div className="relative overflow-hidden rounded-2xl border border-zinc-800/50 bg-zinc-900/30 shadow-[0_20px_80px_rgba(0,0,0,0.5)]">
              <div className="relative aspect-4/3 w-full">
                <img
                  src="/example-board.png"
                  alt="cre8 board with shapes, sticky notes, and AI-generated content"
                  className="size-full object-cover"
                />
              </div>
              {/* Browser chrome bar */}
              <div className="absolute top-0 right-0 left-0 flex items-center gap-1.5 border-b border-zinc-800/40 bg-zinc-950/80 px-3 py-2 backdrop-blur-sm">
                <span className="size-2 rounded-full bg-zinc-800" />
                <span className="size-2 rounded-full bg-zinc-800" />
                <span className="size-2 rounded-full bg-zinc-800" />
                <span className="ml-2 flex-1 rounded-md bg-zinc-900/60 px-2 py-0.5 font-[family-name:var(--font-geist-mono)] text-[9px] text-zinc-600">
                  cre8.cool/board/abc123
                </span>
              </div>
            </div>
            {/* Floating accent */}
            <div className="absolute -right-4 -bottom-4 -z-10 size-32 rounded-full bg-sky-500/5 blur-2xl" />
            <div className="absolute -top-4 -left-4 -z-10 size-24 rounded-full bg-indigo-500/5 blur-2xl" />
          </div>
        </div>

        {/* ── Feature cards ── */}
        <section className="border-t border-zinc-800/40 pt-16 pb-20">
          <div className="grid gap-px overflow-hidden rounded-2xl border border-zinc-800/50 bg-zinc-800/30 sm:grid-cols-3">
            <FeatureCard
              icon={<Sparkles className="size-5" />}
              title="AI Canvas Agent"
              description="Type natural language commands and watch the AI create sticky notes, shapes, frameworks, and complete templates like SWOT analyses."
            />
            <FeatureCard
              icon={<GitFork className="size-5" />}
              title="Repo Architecture Diagrams"
              description="Paste a GitHub URL and get a full architecture diagram — layers, components, and connections laid out automatically on the canvas."
            />
            <FeatureCard
              icon={<MousePointer2 className="size-5" />}
              title="Real-Time Collaboration"
              description="See teammates' cursors move in real time. Every shape, note, and edit syncs instantly across all connected users."
            />
          </div>
        </section>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-800/30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-1.5">
            <Image src="/logo-dark.svg" alt="cre8" width={14} height={14} className="opacity-50" />
            <span className="text-xs font-medium tracking-tight text-zinc-600">cre8</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dev-process"
              className="text-[11px] text-zinc-700 transition-colors hover:text-zinc-400"
            >
              How this was built
            </Link>
            <a
              href="https://github.com/wkhori/cre8"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-zinc-700 transition-colors hover:text-zinc-400"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Supporting components ── */

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group flex flex-col bg-zinc-950 p-6 transition-colors hover:bg-zinc-900/60">
      <span className="flex size-10 items-center justify-center rounded-xl border border-zinc-800/60 bg-zinc-900/60 text-zinc-500 transition-colors group-hover:border-zinc-700 group-hover:text-zinc-300">
        {icon}
      </span>
      <h3 className="mt-4 text-sm font-medium text-zinc-200">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">{description}</p>
    </div>
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
