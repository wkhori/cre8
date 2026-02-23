# AI Cost Analysis — cre8 (CollabBoard)

**Author:** Walid Khori
**Period:** Feb 16 – Feb 22, 2026

---

## Part 1: Development & Testing Costs

### Claude Code (Development Agent)

| Metric | Value |
|--------|-------|
| Plan | Claude Max ($200/month) |
| Plan usage | ~48% consumed before weekly reset |
| Sessions | ~20+ Claude Code sessions over 7 days |
| Primary model | Claude Opus 4.6 (via Claude Code CLI) |
| Commits produced | 135 across all branches |

Claude Code runs on Claude Max ($200/month subscription). At ~48% plan usage over one week of intensive development, the effective cost attributable to this project is approximately **$100** (48% of $200/month).

### OpenAI Codex

| Metric | Value |
|--------|-------|
| Sessions | 3-4 sessions for architecture planning and code review |
| Estimated cost | Minimal — within free tier / Pro plan |

### Production AI Features — Anthropic API Billing (Actual)

Actual costs from the Anthropic API dashboard (`cre8-key-1`), Feb 18–23:

| Model | Input (uncached) | Input (cache read) | Input (cache write) | Output | **Total** |
|-------|------------------|--------------------|---------------------|--------|-----------|
| Claude Haiku 4.5 | $0.59 | $0.03 | $0.05 | $0.41 | **$1.08** |
| Claude Sonnet 4.5 | $1.58 | $0.01 | $0.01 | $2.00 | **$3.60** |
| Claude Sonnet 4.6 | $4.61 | — | — | $1.72 | **$6.33** |
| **Total** | **$6.78** | **$0.04** | **$0.06** | **$4.13** | **$11.01** |

**Daily breakdown:**

| Date | Haiku 4.5 | Sonnet 4.5 | Sonnet 4.6 | Total | Activity |
|------|-----------|------------|------------|-------|----------|
| Feb 18 | $0.16 | $1.61 | — | $1.77 | AI agent v1 (Sonnet), Langfuse integration |
| Feb 19 | — | $0.32 | — | $0.32 | Connectors, performance work |
| Feb 20 | — | $1.28 | — | $1.28 | AI prompt iteration, keyboard shortcuts |
| Feb 21 | $0.48 | $0.39 | — | $0.87 | Migrated AI commands to Haiku, bug fixes |
| Feb 22 | $0.44 | — | $5.78 | $6.22 | Architecture diagram dev (Sonnet 4.6 heavy) |
| Feb 23 | — | — | $0.55 | $0.55 | Final arch diagram testing |

**Key observations:**
- Feb 22 was the most expensive day ($6.22) due to intensive architecture diagram prompt engineering with Sonnet 4.6
- Migrating AI commands from Sonnet → Haiku on Feb 21 cut per-day AI command cost from ~$1.28 to ~$0.44
- Prompt caching saved ~$0.10 total (cache reads $0.04 vs full-price equivalent) — more savings expected at production scale
- Sonnet (4.5 + 4.6 combined) accounts for **90% of total spend** ($9.93 of $11.01)

### Langfuse Trace Metrics

| Metric | AI Command (Haiku) | Analyze Repo (Sonnet) | Total |
|--------|--------------------|-----------------------|-------|
| **Traces** | 133 | 69 | 202 |
| **Input tokens** | 410,833 | 271,040 | 681,873 |
| **Output tokens** | 54,957 | 98,046 | 153,003 |
| **Total tokens** | 465,790 | 369,086 | 834,876 |
| **Avg latency** | 4.1s | 25.3s | — |
| **Failure rate** | 0.75% | 15.9% | 5.9% |
| **AI operations generated** | 2,312 | 7,084 | 9,396 |

### Other AI-Related Costs

| Item | Cost |
|------|------|
| Langfuse | Free tier (10k observations/month) |
| Firebase | Free tier (Spark plan) |
| Vercel | Free tier (Hobby plan) |
| Repomix | Open-source (npm package, no cost) |
| **Total other** | **$0** |

### Total Development Cost Summary

| Category | Cost |
|----------|------|
| Claude Code (Max plan, ~48% usage) | ~$100 |
| OpenAI Codex | ~$0 (within plan) |
| Anthropic API (in-app AI features) | $11.01 |
| Infrastructure (Firebase, Vercel, Langfuse) | $0 |
| **Total** | **~$111** |

---

## Part 2: Production Cost Projections

### A. AI Command Feature (Claude Haiku 4.5)

The core AI feature — natural language board manipulation (create sticky notes, arrange layouts, build templates, etc.).

**Cost per command improved 3.3x over the dev period** through prompt optimization:

| Metric | Early calls (first 10) | Recent calls (last 10) | All 133 traces |
|--------|----------------------|----------------------|----------------|
| Avg cost/call | $0.014 | **$0.004** | $0.008 |
| Avg input tokens | 8,654 | 1,882 | 4,669 |
| Avg output tokens | 1,200+ | 661 | 625 |

The cost dropped because input token count was reduced from ~8K (bloated system prompt + full board state) to ~1.9K (trimmed prompt, selective board context, slash commands).

**For production projections, using the optimized recent cost: $0.004/command***

*\*Token usage and speed have not been fully optimized yet. Further gains possible with prompt caching at scale.*

**Usage assumptions:**

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| AI commands per user per month | 50–100 | 50 = moderate (create template + adjustments, ~4 sessions/mo). 100 = power user (~daily sessions or heavy single sessions) |

**Monthly projections (50 commands/user/month):**

| Scale | Commands/mo | Monthly Cost | Per-User Cost |
|-------|-------------|-------------|---------------|
| **100 users** | 5,000 | **$20** | $0.20 |
| **1,000 users** | 50,000 | **$200** | $0.20 |
| **10,000 users** | 500,000 | **$2,000** | $0.20 |
| **100,000 users** | 5,000,000 | **$20,000** | $0.20 |

**Monthly projections (100 commands/user/month):**

| Scale | Commands/mo | Monthly Cost | Per-User Cost |
|-------|-------------|-------------|---------------|
| **100 users** | 10,000 | **$40** | $0.40 |
| **1,000 users** | 100,000 | **$400** | $0.40 |
| **10,000 users** | 1,000,000 | **$4,000** | $0.40 |
| **100,000 users** | 10,000,000 | **$40,000** | $0.40 |

At production scale, prompt caching would further reduce this — the system prompt (~2K tokens) and tool schemas (~3K tokens) are identical across all users and would be cached at 90% discount. Estimated **30-40% additional cost reduction** at scale.

---

### B. Architecture Diagram Feature (Claude Sonnet 4.6)

The above-and-beyond feature — paste a GitHub URL, generate a full architecture diagram on the canvas. Uses Repomix to compress the repo, Sonnet 4.6 to analyze architecture, and a deterministic layout engine to position everything.

**Cost optimization journey:**

| Metric | Overall avg (69 traces) | Current state |
|--------|------------------------|---------------|
| Avg cost/analysis | $0.144 | **~$0.09*** |
| Avg latency | 25.3s | ~25s |
| Avg components/diagram | 14.8 | 22-26 |

*\*Token usage and speed have not been fully optimized yet. The $0.09 figure reflects current prompt tuning but further gains are possible.*

The overall average ($0.144) is inflated by heavy prompt iteration during development — the same repo (wkhori/cre8) was analyzed 54 times while tuning the prompt and layout engine. Early iterations had bloated prompts and unoptimized output schemas.

**Optimization: Firestore caching**

We implemented a commit-SHA-based Firestore cache (`repo-cache` collection). When a user analyzes a repo that's already been analyzed at the same commit, the cached architecture JSON is returned instantly — **zero LLM cost, <1s latency**. This is critical for cost control since popular repos would be analyzed repeatedly by different users.

**For production projections, using current cost: $0.09/analysis***

**Usage assumptions:**

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Analyses per user per month | 2 | Power-user feature, used sparingly |
| Firestore cache hit rate | 40% | Popular repos shared across users; same-commit = free |
| Effective cost per request | $0.054 | $0.09 × 0.60 (40% are free cache hits) |

**Monthly projections:**

| Scale | Requests/mo | Billable | Monthly Cost | Per-User Cost |
|-------|-------------|----------|-------------|---------------|
| **100 users** | 200 | 120 | **$11** | $0.11 |
| **1,000 users** | 2,000 | 1,200 | **$108** | $0.11 |
| **10,000 users** | 20,000 | 12,000 | **$1,080** | $0.11 |
| **100,000 users** | 200,000 | 120,000 | **$10,800** | $0.11 |

**Cost optimization opportunities (not yet implemented):**
- Migrate to a smaller/cheaper model (Haiku for extraction could reduce cost ~5-10x)
- Stricter output token limits (cap architecture JSON response size)
- Tiered rate limiting (free users get 3 analyses/month, paid unlimited)
- Further prompt compression (current prompt still has room for trimming)

---

### C. Combined Production Cost

**At 50 commands/user/month:**

| Scale | AI Commands | Arch Diagrams | Firebase/Infra* | **Total/month** |
|-------|------------|---------------|-----------------|-----------------|
| **100 users** | $20 | $11 | ~$0 | **$31** |
| **1,000 users** | $200 | $108 | ~$25 | **$333** |
| **10,000 users** | $2,000 | $1,080 | ~$200 | **$3,280** |
| **100,000 users** | $20,000 | $10,800 | ~$2,000 | **$32,800** |

**At 100 commands/user/month:**

| Scale | AI Commands | Arch Diagrams | Firebase/Infra* | **Total/month** |
|-------|------------|---------------|-----------------|-----------------|
| **100 users** | $40 | $11 | ~$0 | **$51** |
| **1,000 users** | $400 | $108 | ~$25 | **$533** |
| **10,000 users** | $4,000 | $1,080 | ~$200 | **$5,280** |
| **100,000 users** | $40,000 | $10,800 | ~$2,000 | **$52,800** |

*\*Firebase costs estimated: Firestore reads/writes, RTDB bandwidth, Auth. Free tier covers ~100 users; Blaze plan scales from there.*

---

### D. Key Takeaways

1. **AI commands are cheap.** Optimized to $0.004/command with Haiku — down 3.3x from early development. At $0.20–$0.40/user/month (50–100 cmds), viable to offer free to all users or easily covered by a modest subscription.

2. **Architecture diagrams are ~22x more expensive per call** ($0.09 vs $0.004) but used much less frequently. Firestore commit-SHA caching is critical — same repo at same commit skips the LLM entirely (zero cost, <1s).

3. **Prompt optimization is the biggest lever.** AI command cost dropped 3.3x just from trimming system prompt and board state serialization. No model change needed — same Haiku model, just less wasted input.

4. **Model selection matters enormously.** Migrating AI commands from Sonnet to Haiku (done on Feb 21) reduced per-command cost by ~4x with acceptable quality for tool-use tasks.

5. **Dev costs ≠ production costs.** The overall $0.144/analysis average is inflated by 54 analyses of the same repo during prompt tuning. Current cost is ~$0.09, and Firestore caching would eliminate ~40% of calls at scale.

6. **Infrastructure costs are negligible at small scale.** Firebase free tier and Vercel Hobby plan handle the first ~100 users with zero cost. AI API calls are the only meaningful expense.
