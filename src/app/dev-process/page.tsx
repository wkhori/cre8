"use client";

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
        {/* ── Tools ── */}
        <section className="py-16">
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

          {/* Optimization story callout */}
          <div className="mt-6 rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-400/90">
              <TrendingDown className="size-4" />
              3.3x cost reduction through prompt optimization
            </div>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              AI command cost dropped from <span className="text-zinc-300">$0.014/call</span> to{" "}
              <span className="font-medium text-emerald-400/80">$0.004/call</span> by trimming the
              system prompt from ~8K to ~1.9K input tokens — same model (Haiku 4.5), just less
              wasted context. Migrating from Sonnet to Haiku earlier in the sprint saved another 4x.
            </p>
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
                <CostRow label="Failure rate" value="0.75%" />
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
                <CostRow label="Failure rate" value="15.9%" />
              </div>
            </div>
          </div>

          {/* Production Projections Chart */}
          <div className="mt-4 rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-5">
            <h3 className="text-sm font-medium text-zinc-100">
              Monthly Production Cost Projections
            </h3>
            <p className="mt-1 text-[11px] text-zinc-600">
              AI commands at $0.004/cmd + arch diagrams at $0.054/effective req (40% cached free)
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {/* 50 cmds/user/mo */}
              <div>
                <p className="mb-2 text-[11px] font-medium tracking-wide text-zinc-400 uppercase">
                  50 commands / user / month
                </p>
                <ProjectionChart cmdsPerUser={50} />
              </div>
              {/* 100 cmds/user/mo */}
              <div>
                <p className="mb-2 text-[11px] font-medium tracking-wide text-zinc-400 uppercase">
                  100 commands / user / month
                </p>
                <ProjectionChart cmdsPerUser={100} />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500/70" />
                AI Commands (Haiku)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-sky-500/70" />
                Arch Diagrams (Sonnet)
              </span>
            </div>
          </div>

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
              title="Connector Implementation"
              prompt="Please review our PRD.md. We have made good progress but we are currently missing a core key feature. We do not have Connector.tsx — lines/arrows between objects — implemented at all. This should be an easy simple addition but it's so important we do it correctly on the first attempt without introducing any bugs. The usage should be intuitive and feel smooth like Figma."
              result="Working connectors with endpoint snapping in a single session"
            />
            <PromptCard
              number={2}
              title="Code Cleanup"
              prompt="I need to clean up this code now so that I can push to GitHub. Pause on future development and clean up the code so it's DRY, well organized, and ready for next phase of development. Remove any 'legacy' or backwards compatible support code or tests since any early test data will be wiped."
              result="Focused refactor — reduced duplication without breaking functionality"
            />
            <PromptCard
              number={3}
              title="AI Agent Planning"
              prompt="Review our current implementation thus far and analyze our progress. Determine a readiness score 1-10 on implementing the final major feature of the app, enabling AI collaboration. Write a plan to implement the new AI features in a way that makes sense."
              result="Phased plan: tool schemas → simulate function → API route → chat UI"
            />
            <PromptCard
              number={4}
              title="Architecture Diagram Feature"
              prompt="Create a feature that lets users paste a GitHub repo URL and generates an architecture diagram on the canvas. Use Repomix to compress the repo, Claude Sonnet to analyze the architecture, and a deterministic layout engine to position everything. The AI should only describe — a layout engine should handle positioning."
              result="Clean separation: Claude describes architecture, layout engine positions deterministically"
            />
          </div>
        </section>

        {/* ── Biggest Mistakes ── */}
        <section className="pb-16">
          <SectionHeading icon={<AlertTriangle className="size-4" />} label="Biggest Mistakes" />
          <div className="mt-6 space-y-3">
            {[
              {
                title: "Abandoned the PRD after day 3",
                body: "Started strong with a Pre-Search doc and detailed PRD, but stopped referencing them after the first few days. The workflow became reactive — fixing whatever felt urgent instead of building against the spec. Features drifted from the original plan and I lost track of what was actually required vs nice-to-have.",
              },
              {
                title: "Tried to one-shot a massive performance refactor",
                body: "Feb 19 was the least productive day despite burning the most tokens. Kept trying to get Claude to optimize everything in one giant prompt. Nothing worked. Had to start over with fresh branches multiple times. The fix: break it into small, verifiable steps and feed concrete trace data instead of vague descriptions.",
              },
              {
                title: "No automated regression tests",
                body: "Had 119 unit tests but zero end-to-end or integration tests that caught real regressions. Would fix one bug and unknowingly break something else. An automated smoke test suite (even just 5 Playwright tests) would have saved hours of manual testing and re-debugging.",
              },
              {
                title: "Never shared for early feedback",
                body: "Kept battling the feeling of 'it needs to be perfect first.' Never shared the deployed app publicly until the final day. Earlier feedback from peers would have caught UX issues, identified missing features, and pressure-tested the multiplayer sync much sooner.",
              },
              {
                title: "Workflow got chaotic as time pressure grew",
                body: "Early days had clean commits, clear plans, methodical progress. By day 5-6, it was scattered — jumping between features, fixing bugs reactively, losing context between sessions. Should have maintained the discipline of the first few days throughout the sprint.",
              },
              {
                title: "Never learned agent worktrees for parallel workflows",
                body: "Kept saying 'I'll learn it next week' but never did. Could have run a main feature task in one worktree while a second agent fixed low-priority bugs in parallel — ping-ponging between both. The intuition was there but time pressure made it feel like a risk. In retrospect, the upfront investment would have paid for itself many times over.",
              },
            ].map((m) => (
              <div key={m.title} className="rounded-xl border border-red-900/30 bg-red-950/10 p-5">
                <h4 className="text-sm font-medium text-red-300/80">{m.title}</h4>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">{m.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Learnings ── */}
        <section className="pb-20">
          <SectionHeading icon={<Brain className="size-4" />} label="Key Learnings" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              {
                title: "Hooks are mandatory",
                body: "Auto-formatting and type-checking after every edit eliminated an entire class of accumulated errors. Should have set these up on day 1.",
              },
              {
                title: "Feed AI data, not descriptions",
                body: "The performance breakthrough came from feeding Chrome DevTools traces to a custom skill — not from describing symptoms.",
              },
              {
                title: "Separate AI judgment from deterministic logic",
                body: "Architecture diagrams work because Claude only describes the architecture while a layout engine positions everything. Same input → same output.",
              },
              {
                title: "Small prompts > big prompts",
                body: "Least productive day was one-shotting a large refactor. Most productive days used focused, sequential prompts with verification between each step.",
              },
              {
                title: "Langfuse pays for itself immediately",
                body: "Seeing token counts and cost per trace informed the Sonnet → Haiku migration — 4x faster, 4x cheaper, quality was sufficient for tool use.",
              },
              {
                title: "Model selection matters enormously",
                body: "Output tokens dominate Sonnet costs. Choosing the right model per task and constraining output is the highest-leverage optimization.",
              },
            ].map((l) => (
              <div
                key={l.title}
                className="rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-5"
              >
                <h4 className="text-sm font-medium text-zinc-100">{l.title}</h4>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">{l.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

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

const projectionChartConfig = {
  aiCommands: { label: "AI Commands", color: "oklch(0.72 0.17 155)" },
  archDiagrams: { label: "Arch Diagrams", color: "oklch(0.65 0.15 230)" },
} satisfies ChartConfig;

function ProjectionChart({ cmdsPerUser }: { cmdsPerUser: number }) {
  const costPerCmd = 0.004;
  const archReqsPerUser = 2;
  const effectiveCostPerArch = 0.054; // $0.09 × 0.60 (40% cached)

  const data = [
    {
      scale: "100",
      aiCommands: 100 * cmdsPerUser * costPerCmd,
      archDiagrams: 100 * archReqsPerUser * effectiveCostPerArch,
    },
    {
      scale: "1K",
      aiCommands: 1000 * cmdsPerUser * costPerCmd,
      archDiagrams: 1000 * archReqsPerUser * effectiveCostPerArch,
    },
    {
      scale: "10K",
      aiCommands: 10000 * cmdsPerUser * costPerCmd,
      archDiagrams: 10000 * archReqsPerUser * effectiveCostPerArch,
    },
    {
      scale: "100K",
      aiCommands: 100000 * cmdsPerUser * costPerCmd,
      archDiagrams: 100000 * archReqsPerUser * effectiveCostPerArch,
    },
  ];

  return (
    <ChartContainer config={projectionChartConfig} className="aspect-4/3 w-full">
      <BarChart data={data} barGap={2}>
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
          tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}`}
          width={48}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) =>
                `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              }
            />
          }
        />
        <Bar dataKey="aiCommands" fill="var(--color-aiCommands)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="archDiagrams" fill="var(--color-archDiagrams)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
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
