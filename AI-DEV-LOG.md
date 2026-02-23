# AI Development Log — cre8 (CollabBoard)

**Author:** Walid Khori
**Project:** cre8 — Real-time collaborative whiteboard with AI agent
**Sprint:** Feb 16 – Feb 22, 2026 (7 days)

---

## Tools & Workflow

| Tool | Role | Usage |
|------|------|-------|
| **Claude Code** (CLI) | Primary development agent | ~90% of all development — architecture, feature implementation, debugging, performance tuning, refactoring, test writing |
| **OpenAI Codex** | Secondary agent for planning | Used for architecture planning and code review sessions; helpful for generating implementation plans that Claude Code then executed |
| **Langfuse** | AI observability | Integrated into both API routes to track every LLM call — tokens, latency, cost, operation types. 202 traced calls total |
| **Repomix** | Codebase compression | Integrated into the `/analyze-repo` feature to pack entire GitHub repositories into a compressed format for Claude analysis |

### Workflow Pattern

My primary workflow was conversational iteration with Claude Code:

1. **Describe intent** in natural language (feature, bug fix, or refactor)
2. **Claude Code reads** relevant files, proposes changes
3. **PostToolUse hooks** auto-format with Prettier and run TypeScript + ESLint checks after every file edit
4. **Iterate** on failures — the hooks catch errors immediately, so Claude fixes them in the same session
5. **Manual test** in browser, then commit

I also configured two **Claude Code hooks** that became essential:
- `format-on-edit.sh` — runs Prettier after every Edit/Write
- `check-on-stop.sh` — runs `tsc --noEmit` + ESLint after every file change, with auto-fix

These hooks eliminated an entire class of bugs (formatting drift, type errors that compound) and meant every file Claude touched was always in a shippable state.

### Custom Skills

- **`/trace-analyzer`** — A custom Claude Code skill I built for analyzing Chrome DevTools Performance trace JSON files. This was a major unlock: I could record a trace of the canvas with 500+ objects, feed it to Claude, and get back a structured breakdown of long tasks, GC pressure, layout thrashing, and dropped frames. This directly drove the performance optimization sprint on Feb 19.
- **`/frontend-design`** — Anthropic's built-in skill for creating production-grade frontend interfaces. Used for the landing page, board listing, and UI polish passes to avoid generic AI aesthetics.

---

## MCP Usage

I did not use MCP server integrations during this project. The combination of Claude Code's native file/terminal access, Langfuse for observability, and Repomix for repository analysis covered my needs. In retrospect, a GitHub MCP could have streamlined PR creation and issue tracking.

---

## Effective Prompts

### 1. Connector Implementation (Feature)

> "Please review our PRD.md. We have made good progress but we are currently missing a core key feature. We do not have Connector.tsx — lines/arrows between objects — implemented at all. This should be an easy simple addition but it's so important we do it correctly on the first attempt without introducing any bugs or unwanted behavior. The usage should be intuitive and feel smooth like Figma. Users should be able to quickly click and drag an arrow to connect two elements. Establish a plan and implement this new arrow/line feature into our current existing functionalities."

**Why it worked:** Grounded in the PRD, set a clear quality bar ("like Figma"), acknowledged the risk ("correctly on the first attempt"), and asked for a plan before implementation. Claude Code produced working connectors with endpoint snapping in a single session.

### 2. Performance Debugging (Analysis + Fix)

> "Good job. I need to clean up this code now so that I can push to GitHub. I got carried away and forgot to make any commits. We will pause on future development progress temporarily and clean up the code so it's DRY, well organized, and ready for next phase of development. Do a quick review and make any code cleanup changes required while maintaining all current functionality. Remove any 'legacy' or backwards compatible support code or tests since any early test data will be wiped."

**Why it worked:** Clear scope boundaries — cleanup only, no new features. Explicitly preserved functionality while authorizing removal of legacy code. This produced a focused refactor that reduced code duplication without breaking anything.

### 3. AI Agent Architecture (Complex Feature)

> "Review our current implementation thus far and analyze our progress. Determine a readiness score 1-10 on implementing the final major feature of the app, enabling AI collaboration. Write a plan to implement the new AI features in a way that makes sense."

**Why it worked:** Asked for assessment before implementation. Claude Code reviewed the entire codebase, identified the right insertion points, and produced a phased plan (tool schemas → simulate function → API route → chat UI). The resulting AI agent was implemented cleanly with proper separation of concerns.

### 4. Architecture Diagram Feature (Above & Beyond)

> "Create a feature that lets users paste a GitHub repo URL and generates an architecture diagram on the canvas. Use Repomix to compress the repo, Claude Sonnet to analyze the architecture, and a deterministic layout engine to position everything. The AI should only describe the architecture — a layout engine should handle positioning. Same input = same output."

**Why it worked:** Explicitly separated concerns (Claude describes, layout engine positions) which is a key architectural insight. This produced the cleanest AI feature in the app — the `analyze-repo` route + `architecture-layout.ts` layout engine.

### 5. Hooks Setup (Developer Productivity)

> "Set up PostToolUse hooks that run Prettier format after every Edit/Write, and also run tsc --noEmit + eslint after every file change with auto-fix. This way every file you touch is always in a shippable state."

**Why it worked:** Meta-prompt that improved all subsequent prompts. After this, Claude Code's output was always formatted and type-checked, eliminating an entire category of iteration cycles.

---

## Code Analysis

| Category | Estimated % | Notes |
|----------|-------------|-------|
| **AI-generated (Claude Code)** | ~85% | Core canvas logic, state management, Firebase sync, AI agent, all UI components |
| **AI-generated (Codex)** | ~5% | Architecture planning docs, some code review suggestions |
| **Hand-written** | ~10% | Prompt engineering, configuration, hooks, debugging decisions, manual CSS tweaks |

**135 commits** across 7 days. The codebase includes 50+ source files spanning canvas rendering, state management, real-time sync, AI agent integration, and the architecture diagram feature.

AI generated the vast majority of the code, but the *direction* — what to build, in what order, with what architecture — was entirely human-driven. The most valuable human contributions were:
- Choosing zustand over Redux for state management
- Deciding on flat Firestore model with logical `parentId` (vs nested Konva Groups)
- Separating RTDB (high-frequency cursors) from Firestore (persistent objects)
- The "Claude describes, layout engine positions" pattern for architecture diagrams

---

## Strengths & Limitations

### Where AI Excelled

- **Boilerplate generation** — Firebase config, zustand stores, API routes, shadcn component wiring. Huge time savings on code that's structurally predictable.
- **Multi-file refactors** — Claude Code could read 10+ files, understand their relationships, and make coordinated changes across all of them in a single session.
- **Test writing** — Given existing code, Claude produced comprehensive Vitest test suites (119 tests across 11 files) with good edge case coverage.
- **Performance optimization** — When given a Chrome DevTools trace via `/trace-analyzer`, Claude identified specific bottlenecks (O(N) Transformer getClientRect, stage traversal in drag handler) and produced targeted fixes.
- **Pattern consistency** — Once a pattern was established (e.g., the sync wiring pattern), Claude applied it consistently to new features without drift.

### Where AI Struggled

- **Performance work without traces** — Feb 19 was my least productive day. I spent massive tokens trying to get Claude to optimize performance with vague instructions ("make it faster"). Nothing worked until I started feeding it concrete trace data. Lesson: AI needs *specific data*, not vibes.
- **Visual design judgment** — AI-generated layouts were functional but generic. The `/frontend-design` skill helped, but I still needed manual CSS tweaks for the landing page and board cards to feel polished.
- **Complex state interactions** — Frame containment (parentId management, re-parenting on drag, Firestore deleteField sentinel) required multiple debugging cycles. Claude would fix one edge case and introduce another. This was the hardest bug category.
- **Prompt engineering for AI features** — Getting Claude (Haiku) to produce good spatial layouts via tool use required extensive prompt iteration. The system prompt went through 5+ major revisions.
- **One-shotting large refactors** — I kept trying to do the performance refactor in one prompt. It needed to be broken into smaller, verifiable steps. Multi-session work with clear checkpoints worked much better.

---

## Key Learnings

1. **Hooks are mandatory.** Auto-formatting and type-checking after every edit eliminated an entire class of accumulated errors. Should have set these up on day 1.

2. **Feed AI data, not descriptions.** The performance debugging breakthrough came from feeding Chrome DevTools traces to a custom skill — not from describing symptoms. AI works best with concrete artifacts.

3. **Separate AI judgment from deterministic logic.** The architecture diagram feature works because Claude only *describes* the architecture (creative, non-deterministic), while a layout engine *positions* everything (deterministic). Same input → same output. This pattern produces much more reliable results than letting AI control layout.

4. **Small prompts > big prompts.** My least productive day was spent trying to one-shot a large performance refactor. My most productive days used focused, sequential prompts with verification between each step.

5. **Langfuse pays for itself immediately.** Being able to see token counts, latency, and cost per trace let me make informed decisions — like migrating from Sonnet to Haiku for the AI agent (4x faster, 4x cheaper, quality was sufficient for tool-use).

6. **AI cost is dominated by output tokens.** Sonnet's output tokens ($15/MTok) accounted for 80% of the Sonnet spend despite only 34% of traces. Choosing the right model for each task matters enormously.
