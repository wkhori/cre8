"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  GitCommit,
  Cpu,
  Zap,
  DollarSign,
  Brain,
  Terminal,
  BarChart3,
  Clock,
  Layers,
  Code2,
  Bot,
  MousePointer2,
  Workflow,
  AlertTriangle,
  TrendingDown,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

/* ── Data ─────────────────────────────────────────────────────────── */

const TIMELINE: {
  date: string;
  label: string;
  commits: number;
  cost: string;
  highlights: string[];
}[] = [
  {
    date: "Feb 16",
    label: "Day 1 — Genesis",
    commits: 8,
    cost: "$0",
    highlights: [
      "Initial commit — Next.js 16 + React 19 + Konva canvas",
      "Firebase Auth (Google + email), dark/light mode",
      "Infinite canvas with pan/zoom, shape primitives",
    ],
  },
  {
    date: "Feb 17",
    label: "Day 2 — Foundation",
    commits: 12,
    cost: "$0",
    highlights: [
      "Connectors (lines/arrows between shapes)",
      "AI agent v1 — Claude integration with tool use",
      "Frames with logical parentId containment",
      "Real-time cursors + presence via RTDB",
    ],
  },
  {
    date: "Feb 18",
    label: "Day 3 — AI & Sync",
    commits: 16,
    cost: "$1.77",
    highlights: [
      "Langfuse observability wired to AI routes",
      "Board management — create, rename, delete, favorites",
      "AI prompt tuning — SWOT analysis, grids, flowcharts",
      "Deterministic layout tools (createGrid, createRow)",
    ],
  },
  {
    date: "Feb 19",
    label: "Day 4 — Performance",
    commits: 28,
    cost: "$0.32",
    highlights: [
      "Viewport culling + shape lookup Map",
      "Detach Transformer during zoom (O(N) fix)",
      "RAF-batched drag overlay, render-only sync mode",
      "Migrated to Haiku — 4x faster, 4x cheaper",
    ],
  },
  {
    date: "Feb 20",
    label: "Day 5 — Polish",
    commits: 12,
    cost: "$1.28",
    highlights: [
      "UI/UX revamp — toolbar, map controls, AI FAB",
      "Critical performance bottleneck fixed",
      "Keyboard shortcuts dialog (? key)",
      "Debug dashboard consolidated into ui-store",
    ],
  },
  {
    date: "Feb 21",
    label: "Day 6 — Bug Sweep",
    commits: 22,
    cost: "$0.87",
    highlights: [
      "Frame containment bug — deleteField() sentinel",
      "Board timestamp fix — touchBoardTimestamp() throttle",
      "UI + layout revamp, connector toolbar",
      "Canvas controls refactor into composable hooks",
    ],
  },
  {
    date: "Feb 22",
    label: "Day 7 — Architecture Diagrams",
    commits: 37,
    cost: "$6.22",
    highlights: [
      "Analyze-repo feature — Repomix + Sonnet 4.6",
      "Deterministic layout engine (955 lines)",
      "Curved/elbowed connectors, image export",
      "Firestore cache for repo analyses",
    ],
  },
];

const TOOLS: { name: string; role: string; icon: React.ReactNode }[] = [
  {
    name: "Claude Code",
    role: "Primary dev agent — ~90% of code",
    icon: <Terminal className="size-5" />,
  },
  {
    name: "OpenAI Codex",
    role: "Architecture planning sessions",
    icon: <Brain className="size-5" />,
  },
  {
    name: "Langfuse",
    role: "AI observability — every LLM call traced",
    icon: <BarChart3 className="size-5" />,
  },
  {
    name: "Repomix",
    role: "Codebase compression for AI analysis",
    icon: <Layers className="size-5" />,
  },
];

const STATS: { value: string; label: string; icon: React.ReactNode }[] = [
  { value: "135", label: "Commits", icon: <GitCommit className="size-4" /> },
  { value: "7", label: "Days", icon: <Clock className="size-4" /> },
  { value: "~90%", label: "AI-Generated Code", icon: <Bot className="size-4" /> },
  { value: "$11.01", label: "API Cost", icon: <DollarSign className="size-4" /> },
  { value: "202", label: "LLM Traces", icon: <Cpu className="size-4" /> },
  { value: "9,396", label: "AI Operations", icon: <Zap className="size-4" /> },
];

const DEV_STATS: { value: string; label: string }[] = [
  { value: "606", label: "Claude Code Messages" },
  { value: "76", label: "Sessions" },
  { value: "+31,251", label: "Lines Written" },
  { value: "378", label: "Files Touched" },
  { value: "70.3s", label: "Median Response Loop" },
  { value: "72%", label: "Goals Achieved" },
];

/* ── Page ─────────────────────────────────────────────────────────── */

export default function DevProcessPage() {
  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100">
      {/* ── Ambient layers ── */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(120,119,198,0.12),transparent)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_80%_60%,rgba(56,189,248,0.06),transparent_50%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(transparent_31px,rgba(255,255,255,0.02)_32px),linear-gradient(90deg,transparent_31px,rgba(255,255,255,0.02)_32px)] bg-size-[32px_32px]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(9,9,11,0.7))]" />

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
          >
            <ArrowLeft className="size-4" />
            <Image src="/logo-dark.svg" alt="cre8" width={16} height={16} className="opacity-70" />
            <span className="font-medium tracking-tight">cre8</span>
          </Link>
          <span className="text-[11px] tracking-[0.15em] text-zinc-600 uppercase">
            How This Was Made
          </span>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header className="relative mx-auto max-w-5xl px-6 pt-20 pb-16">
        <p className="mb-4 text-[11px] tracking-[0.2em] text-zinc-500 uppercase">
          AI-First Development Log
        </p>
        <h1 className="text-[clamp(2rem,5vw,3.5rem)] leading-[1.08] font-semibold tracking-[-0.03em] text-white">
          7 days. 135 commits.
          <br />
          <span className="bg-linear-to-r from-zinc-300 via-zinc-400 to-zinc-600 bg-clip-text text-transparent">
            One AI-powered sprint.
          </span>
        </h1>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-zinc-400">
          cre8 was built in a single week using AI-first development — Claude Code wrote ~90% of the
          codebase while a human steered architecture, design, and debugging decisions.
        </p>
      </header>

      {/* ── Stats strip ── */}
      <section className="border-y border-zinc-800/60 bg-zinc-900/30">
        <div className="mx-auto grid max-w-5xl grid-cols-3 gap-px bg-zinc-800/40 sm:grid-cols-6">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1.5 bg-zinc-950 px-4 py-6">
              <span className="text-zinc-500">{s.icon}</span>
              <span className="text-xl font-semibold tracking-tight text-white">{s.value}</span>
              <span className="text-[11px] text-zinc-500">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6">
        {/* ── Development Process ── */}
        <section className="py-16">
          <SectionHeading icon={<MessageSquare className="size-4" />} label="Development Process" />
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            606 Claude Code messages across 76 sessions over 7 days — a rapid-fire dialogue where AI
            proposes, human evaluates in ~70 seconds, and AI adjusts.
          </p>
          <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {DEV_STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-3 py-4 text-center"
              >
                <span className="text-lg font-semibold tracking-tight text-white">{s.value}</span>
                <p className="mt-1 text-[10px] leading-tight text-zinc-600">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Claude Code narrative */}
          <div className="mt-4 rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-5">
            <p className="text-sm leading-relaxed text-zinc-400">
              Claude Code wrote <span className="text-zinc-200">~90% of the codebase</span> — but
              the <em>direction</em> was entirely human-driven. The most valuable human
              contributions were architectural: choosing zustand over Redux, separating RTDB
              (high-frequency cursors) from Firestore (persistent objects), and designing the
              &quot;AI describes, layout engine positions&quot; pattern for architecture diagrams.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              47% of sessions were <span className="text-zinc-200">bug fixes</span>, not new
              features. The real value of AI coding isn&apos;t &quot;build faster&quot; — it&apos;s
              &quot;fix faster.&quot; Claude excelled at reading 10+ files, understanding state
              interactions, and finding root causes across multi-file codebases.
            </p>
          </div>
        </section>

        {/* ── Tools ── */}
        <section className="pb-16">
          <SectionHeading icon={<Code2 className="size-4" />} label="Toolchain" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {TOOLS.map((t) => (
              <div
                key={t.name}
                className="group rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-5 transition-colors hover:border-zinc-700/80 hover:bg-zinc-900/60"
              >
                <div className="mb-2 flex items-center gap-3">
                  <span className="text-zinc-500 transition-colors group-hover:text-zinc-300">
                    {t.icon}
                  </span>
                  <span className="font-medium text-zinc-100">{t.name}</span>
                </div>
                <p className="text-sm leading-relaxed text-zinc-500">{t.role}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Timeline ── */}
        <section className="pb-16">
          <SectionHeading icon={<Workflow className="size-4" />} label="Build Timeline" />
          <div className="relative mt-8">
            {/* Vertical line */}
            <div className="absolute top-0 bottom-0 left-[23px] w-px bg-linear-to-b from-zinc-800 via-zinc-700 to-zinc-800 sm:left-[31px]" />

            <div className="space-y-1">
              {TIMELINE.map((day, i) => (
                <div key={day.date} className="group relative flex gap-4 sm:gap-6">
                  {/* Dot */}
                  <div className="relative z-10 mt-6 flex size-[48px] shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-[11px] font-medium tracking-tight text-zinc-400 transition-colors group-hover:border-zinc-600 group-hover:text-zinc-200 sm:size-[64px] sm:text-xs">
                    {day.date.replace("Feb ", "2/")}
                  </div>

                  {/* Card */}
                  <div className="flex-1 rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5 transition-colors group-hover:border-zinc-700/60 group-hover:bg-zinc-900/50">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="font-medium text-zinc-100">{day.label}</h3>
                      <div className="flex items-center gap-3 text-[11px] text-zinc-600">
                        <span className="flex items-center gap-1">
                          <GitCommit className="size-3" />
                          {day.commits} commits
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="size-3" />
                          {day.cost} API
                        </span>
                      </div>
                    </div>
                    <ul className="mt-3 space-y-1.5">
                      {day.highlights.map((h, j) => (
                        <li key={j} className="flex gap-2 text-sm leading-relaxed text-zinc-400">
                          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-zinc-700" />
                          {h}
                        </li>
                      ))}
                    </ul>
                    {/* Progress bar — cumulative commits */}
                    <div className="mt-4 h-1 overflow-hidden rounded-full bg-zinc-800/60">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-zinc-600 to-zinc-400 transition-all duration-500"
                        style={{
                          width: `${Math.round((TIMELINE.slice(0, i + 1).reduce((s, d) => s + d.commits, 0) / 135) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Cost Analysis Summary ── */}
        <section className="pb-16">
          <SectionHeading icon={<DollarSign className="size-4" />} label="Cost Analysis" />

          {/* Optimization story — two cards */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-400/90">
                <TrendingDown className="size-4" />
                3.3x — Prompt Optimization
              </div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                AI command cost dropped from <span className="text-zinc-300">$0.014</span> to{" "}
                <span className="font-medium text-emerald-400/80">$0.004/call</span> by trimming the
                system prompt from ~8K to ~1.9K input tokens. Same model (Haiku 4.5), just less
                wasted context.
              </p>
            </div>
            <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-400/90">
                <TrendingDown className="size-4" />
                8.2x — Model Migration
              </div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Switching AI commands from Sonnet to Haiku cut cost per call from{" "}
                <span className="text-zinc-300">$0.051</span> to{" "}
                <span className="font-medium text-emerald-400/80">$0.006</span>. Quality was
                sufficient for tool-use tasks — simpler output, but good enough.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {/* AI Commands */}
            <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                <MousePointer2 className="size-4 text-emerald-400/80" />
                AI Commands — Haiku 4.5
              </div>
              <p className="mt-1 text-[11px] text-zinc-600">Natural language board manipulation</p>
              <div className="mt-4 space-y-2 text-sm">
                <CostRow label="133 traces" value="$1.08 total" />
                <CostRow label="Avg latency" value="4.1s" />
                <CostRow label="Cost per command" value="$0.004" accent />
              </div>
            </div>

            {/* Architecture Diagrams */}
            <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                <Layers className="size-4 text-sky-400/80" />
                Arch Diagrams — Sonnet 4.6
              </div>
              <p className="mt-1 text-[11px] text-zinc-600">
                GitHub repo → architecture visualization
              </p>
              <div className="mt-4 space-y-2 text-sm">
                <CostRow label="69 traces" value="$9.93 total" />
                <CostRow label="Avg latency" value="25.3s" />
                <CostRow label="Cost per analysis" value="$0.09" accent />
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-sky-400/60">
                Still in active development — feature launched today. Uses Repomix + Sonnet 4.6 to
                analyze any GitHub repo and generate a visual architecture diagram on the canvas.
              </p>
            </div>
          </div>

          {/* Production Projections */}
          <ProjectionSection />

          {/* Total bar */}
          <div className="mt-4 rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-zinc-100">Total Development API Spend</span>
              <span className="text-2xl font-semibold tracking-tight text-white">$11.01</span>
            </div>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-zinc-800/60">
              <div
                className="bg-emerald-500/60"
                style={{ width: `${(1.08 / 11.01) * 100}%` }}
                title="Haiku 4.5"
              />
              <div
                className="bg-amber-500/60"
                style={{ width: `${(3.6 / 11.01) * 100}%` }}
                title="Sonnet 4.5"
              />
              <div
                className="bg-sky-500/60"
                style={{ width: `${(6.33 / 11.01) * 100}%` }}
                title="Sonnet 4.6"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500/60" />
                Haiku 4.5 — $1.08
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-500/60" />
                Sonnet 4.5 — $3.60
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-sky-500/60" />
                Sonnet 4.6 — $6.33
              </span>
            </div>
          </div>
        </section>

        {/* ── Key Prompts ── */}
        <section className="pb-16">
          <SectionHeading icon={<Terminal className="size-4" />} label="Effective Prompts" />
          <div className="mt-6 space-y-3">
            <PromptCard
              number={1}
              title="Feature Implementation with Quality Constraints"
              prompt="Review PRD.md. We're missing a core feature: Connector.tsx — lines and arrows between objects. This needs to work correctly on the first attempt without introducing bugs. The UX should feel smooth and intuitive like Figma — users click and drag an arrow to connect two elements. Establish a plan and implement it."
              result="Working connectors with endpoint snapping, shipped in a single session with zero regressions"
            />
            <PromptCard
              number={2}
              title="Readiness Assessment Before Major Feature"
              prompt="Review the current implementation and analyze progress. Determine a readiness score (1-10) for implementing the final major feature — AI collaboration. Write a phased plan to implement the AI features in a way that builds on existing architecture."
              result="Scored 8/10 readiness. Delivered a phased plan: tool schemas → simulate function → API route → chat UI"
            />
            <PromptCard
              number={3}
              title="Separating AI Judgment from Layout Logic"
              prompt="Build a feature that takes a GitHub repo URL and generates an architecture diagram on the canvas. Use Repomix to compress the repo, Claude Sonnet to analyze the structure, and a deterministic layout engine to position everything. The AI should only describe the architecture — the layout engine handles all positioning."
              result="Clean separation of concerns — Claude describes, layout engine positions. Same repo always produces the same diagram."
            />
          </div>
        </section>

        {/* ── Lessons Learned ── */}
        <section className="pb-20">
          <SectionHeading icon={<AlertTriangle className="size-4" />} label="Lessons Learned" />

          <div className="mt-6 rounded-xl border border-zinc-800/70 bg-zinc-900/40 overflow-hidden">
            {/* Intro */}
            <div className="px-6 pt-6 pb-5 border-b border-zinc-800/50">
              <p className="text-sm leading-relaxed text-zinc-400">
                Seven days of AI-first development surfaced a clear pattern:{" "}
                <span className="text-zinc-200">
                  the mistakes and wins are two sides of the same coin
                </span>
                . Every failure pointed directly to a working principle.
              </p>
            </div>

            {/* Paired lessons */}
            <div className="divide-y divide-zinc-800/50">
              <LessonRow
                mistake="Tried to one-shot a massive performance refactor"
                mistakeDetail='Day 4 burned the most tokens but was the least productive. Vague instructions like "make it faster" produced sprawling, broken changes.'
                lesson="Small prompts beat big prompts"
                lessonDetail="Breaking the same refactor into focused, sequential steps with verification between each produced working code. Feed Chrome DevTools traces, not symptom descriptions."
              />
              <LessonRow
                mistake="Stopped referencing the PRD after day 3"
                mistakeDetail="Development became reactive — fixing whatever felt urgent instead of building against the spec. Features drifted from the original plan."
                lesson="The skill is steering, not prompting"
                lessonDetail="53 wrong-approach redirects across 76 sessions. AI agents over-engineer constantly. The human value is catching bad paths early — 72% of sessions still hit their goal through active course correction."
              />
              <LessonRow
                mistake="Zero E2E tests meant silent regressions"
                mistakeDetail="119 unit tests but no Playwright tests. Fixing one bug would unknowingly break another. Even 5 integration tests would have saved hours."
                lesson="Observability enables real decisions"
                lessonDetail="Wiring Langfuse on day 3 gave visibility into token counts, latency, and cost per trace. That data drove the Sonnet → Haiku migration with confidence instead of guesswork."
              />
            </div>

            {/* Standalone takeaway */}
            <div className="px-6 py-5 border-t border-zinc-800/50 bg-zinc-950/30">
              <p className="text-sm leading-relaxed text-zinc-400">
                <span className="font-medium text-zinc-200">The architectural takeaway:</span>{" "}
                separate AI judgment from deterministic logic. Architecture diagrams work because
                Claude only describes the structure while a layout engine handles positioning —
                nondeterministic reasoning paired with deterministic rendering produces consistent
                output every time.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* ── CTA ── */}
      <section className="border-t border-zinc-800/60 bg-zinc-900/20">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <p className="text-[11px] tracking-[0.2em] text-zinc-600 uppercase">Try it yourself</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            cre8 is live and open source
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-500">
            Real-time collaborative whiteboard with an AI agent that manipulates the canvas through
            natural language. Paste a GitHub URL and get an architecture diagram in 30 seconds.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href="/"
              className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
            >
              Open cre8
            </Link>
            <a
              href="https://github.com/wkhori/cre8"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
            >
              GitHub
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-800/60 bg-zinc-950/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-1.5">
            <Image src="/logo-dark.svg" alt="cre8" width={16} height={16} className="opacity-70" />
            <span className="text-xs font-medium tracking-tight text-zinc-500">cre8</span>
          </div>
          <p className="text-[11px] text-zinc-600">Built Feb 16–22, 2026 — Gauntlet G4 Week 1</p>
        </div>
      </footer>
    </div>
  );
}

/* ── Chart ────────────────────────────────────────────────────────── */

const SCALES = [100, 1_000, 10_000, 100_000] as const;
const SCALE_LABELS: Record<number, string> = {
  100: "100",
  1000: "1K",
  10000: "10K",
  100000: "100K",
};

const aiCmdConfig = {
  cost: { label: "Monthly Cost", color: "oklch(0.72 0.17 155)" },
} satisfies ChartConfig;

function ProjectionSection() {
  const [cmdsPerUser, setCmdsPerUser] = useState<50 | 100>(50);

  const costPerCmd = 0.004;

  // Lock Y-axis to the 100 cmds/user max so bars visually grow on toggle
  const aiMax = 100_000 * 100 * costPerCmd; // $40K

  const aiData = SCALES.map((s) => ({
    scale: SCALE_LABELS[s],
    cost: s * cmdsPerUser * costPerCmd,
  }));

  return (
    <div className="mt-4">
      <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500/70" />
            <span className="text-[11px] font-medium text-zinc-400">
              AI Commands — Haiku 4.5 — Production Projection
            </span>
          </div>
          <div className="flex rounded-md border border-zinc-700/60 bg-zinc-800/40 p-0.5">
            {([50, 100] as const).map((n) => (
              <button
                key={n}
                onClick={() => setCmdsPerUser(n)}
                className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  cmdsPerUser === n ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {n}/user/mo
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1 text-[11px] text-zinc-600">
          $0.004/cmd &middot; projected monthly cost by user scale
        </p>
        <ChartContainer config={aiCmdConfig} className="mt-3 aspect-[2.5/1] w-full">
          <BarChart data={aiData} barGap={2}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="scale"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#71717a", fontSize: 11 }}
              tickFormatter={(v) => `${v} users`}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#71717a", fontSize: 11 }}
              tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}`}
              width={48}
              domain={[0, aiMax]}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) =>
                    `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo`
                  }
                />
              }
            />
            <Bar dataKey="cost" fill="var(--color-cost)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
}

/* ── Components ───────────────────────────────────────────────────── */

function SectionHeading({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-zinc-600">{icon}</span>
      <h2 className="text-xs font-medium tracking-[0.15em] text-zinc-500 uppercase">{label}</h2>
    </div>
  );
}

function CostRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className={accent ? "font-medium text-emerald-400/90" : "text-zinc-300"}>{value}</span>
    </div>
  );
}

function LessonRow({
  mistake,
  mistakeDetail,
  lesson,
  lessonDetail,
}: {
  mistake: string;
  mistakeDetail: string;
  lesson: string;
  lessonDetail: string;
}) {
  return (
    <div className="grid gap-px sm:grid-cols-2">
      <div className="px-6 py-5 sm:border-r sm:border-zinc-800/50">
        <div className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-red-400/70 uppercase">
          <span className="size-1.5 rounded-full bg-red-400/50" />
          What went wrong
        </div>
        <h4 className="mt-2 text-sm font-medium text-zinc-200">{mistake}</h4>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{mistakeDetail}</p>
      </div>
      <div className="px-6 py-5">
        <div className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-emerald-400/70 uppercase">
          <span className="size-1.5 rounded-full bg-emerald-400/50" />
          What I learned
        </div>
        <h4 className="mt-2 text-sm font-medium text-zinc-200">{lesson}</h4>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{lessonDetail}</p>
      </div>
    </div>
  );
}

function PromptCard({
  number,
  title,
  prompt,
  result,
}: {
  number: number;
  title: string;
  prompt: string;
  result: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-6 items-center justify-center rounded-md bg-zinc-800 text-[11px] font-medium text-zinc-400">
          {number}
        </span>
        <h4 className="text-sm font-medium text-zinc-100">{title}</h4>
      </div>
      <div className="mt-3 rounded-lg border border-zinc-800/50 bg-zinc-950/60 px-4 py-3">
        <p className="font-[family-name:var(--font-geist-mono)] text-[13px] leading-relaxed text-zinc-400">
          &quot;{prompt}&quot;
        </p>
      </div>
      <p className="mt-2.5 text-sm text-zinc-500">
        <span className="font-medium text-emerald-400/70">Result:</span> {result}
      </p>
    </div>
  );
}
