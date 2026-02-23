# AI Cost Analysis — cre8 (CollabBoard)

**Author:** Walid Khori
**Period:** Feb 16 – Feb 22, 2026

---

## Part 1: Development & Testing Costs

### Claude Code (Development Agent)

| Metric | Value |
|--------|-------|
| Plan usage | ~48% of Pro plan consumed before reset |
| Sessions | ~20+ Claude Code sessions over 7 days |
| Primary model | Claude Opus 4.6 (via Claude Code CLI) |
| Commits produced | 135 across all branches |

Claude Code runs on a subscription plan (Claude Pro), so the cost is a flat monthly rate rather than per-token. At ~48% plan usage over one week of intensive development, the effective cost attributable to this project is approximately **$50** (half of a $100/month Pro plan estimate).

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
| Claude Code (Pro plan, ~48% usage) | ~$50 |
| OpenAI Codex | ~$0 (within plan) |
| Anthropic API (in-app AI features) | $11.01 |
| Infrastructure (Firebase, Vercel, Langfuse) | $0 |
| **Total** | **~$61** |

---

## Part 2: Production Cost Projections

### A. AI Command Feature (Claude Haiku 4.5)

The core AI feature — natural language board manipulation (create sticky notes, arrange layouts, build templates, etc.).

**Assumptions:**

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Avg AI commands per session | 5 | Typical brainstorming session: create template + 3-4 adjustments |
| Avg sessions per user per month | 8 | ~2 sessions/week for active users |
| Avg input tokens per command | 4,669 | Measured from 88 Haiku traces (includes board state context) |
| Avg output tokens per command | 625 | Measured from 88 Haiku traces |
| Prompt caching hit rate | 60% | System prompt + tool schemas are static; board state varies |
| Cached input price | $0.08/MTok | 90% discount on cached tokens |

**Cost per AI command (with caching):**

| Component | Tokens | Effective $/MTok | Cost |
|-----------|--------|------------------|------|
| Input (40% uncached) | 1,868 | $0.80 | $0.0015 |
| Input (60% cached) | 2,801 | $0.08 | $0.0002 |
| Output | 625 | $4.00 | $0.0025 |
| **Total per command** | | | **$0.0042** |

**Monthly projections:**

| Scale | Users | Commands/mo | Monthly Cost | Per-User Cost |
|-------|-------|-------------|-------------|---------------|
| **100 users** | 100 | 4,000 | **$17** | $0.17 |
| **1,000 users** | 1,000 | 40,000 | **$168** | $0.17 |
| **10,000 users** | 10,000 | 400,000 | **$1,680** | $0.17 |
| **100,000 users** | 100,000 | 4,000,000 | **$16,800** | $0.17 |

The AI command feature scales linearly and is very affordable — **$0.17/user/month**. Haiku's low cost ($0.80/$4.00 per MTok) combined with prompt caching makes this viable even at scale without rate limiting.

---

### B. Architecture Diagram Feature (Claude Sonnet 4.6)

The above-and-beyond feature — paste a GitHub URL, generate a full architecture diagram on the canvas. This is significantly more expensive per call.

**Assumptions:**

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Avg diagram generations per session | 1.5 | Users typically analyze 1-2 repos per session |
| Avg sessions using this feature per user per month | 2 | Power-user feature, less frequent than AI commands |
| Avg input tokens per analysis | 6,160 | Measured from 44 Sonnet traces (compressed repo content) |
| Avg output tokens per analysis | 2,228 | Measured from 44 Sonnet traces (architecture JSON) |
| Prompt caching hit rate | 40% | System prompt is cached; repo content varies per call |
| Cached input price | $0.30/MTok | 90% discount on cached tokens |
| Firestore cache hit rate | 30% | Same repo+commit returns cached result (no LLM call) |
| Repomix processing | $0 | Runs serverless, no external API cost |

**Cost per architecture analysis (with caching, excluding Firestore cache hits):**

| Component | Tokens | Effective $/MTok | Cost |
|-----------|--------|------------------|------|
| Input (60% uncached) | 3,696 | $3.00 | $0.0111 |
| Input (40% cached) | 2,464 | $0.30 | $0.0007 |
| Output | 2,228 | $15.00 | $0.0334 |
| **Total per analysis** | | | **$0.0452** |

**Effective cost after Firestore caching:** $0.0452 × 0.70 = **$0.0317** per request (30% of requests are free cache hits).

**Monthly projections:**

| Scale | Users | Analyses/mo | Monthly Cost | Per-User Cost |
|-------|-------|-------------|-------------|---------------|
| **100 users** | 100 | 210 | **$7** | $0.07 |
| **1,000 users** | 1,000 | 2,100 | **$67** | $0.07 |
| **10,000 users** | 10,000 | 21,000 | **$665** | $0.07 |
| **100,000 users** | 100,000 | 210,000 | **$6,650** | $0.07 |

The architecture diagram feature costs **$0.07/user/month** — also reasonable, though the per-call cost ($0.045) is ~10x higher than an AI command ($0.004). Firestore caching is critical here: repeated analyses of the same repo (same commit SHA) skip the LLM entirely.

**Cost optimization opportunities (not yet implemented):**
- Migrate to a smaller model for architecture extraction (could reduce cost 3-5x)
- Stricter output token limits (cap JSON response size)
- Tiered rate limiting (free users get 3 analyses/month, paid get unlimited)

---

### C. Combined Production Cost

| Scale | AI Commands | Arch Diagrams | Firebase/Infra* | **Total/month** |
|-------|------------|---------------|-----------------|-----------------|
| **100 users** | $17 | $7 | ~$0 | **$24** |
| **1,000 users** | $168 | $67 | ~$25 | **$260** |
| **10,000 users** | $1,680 | $665 | ~$200 | **$2,545** |
| **100,000 users** | $16,800 | $6,650 | ~$2,000 | **$25,450** |

*\*Firebase costs estimated: Firestore reads/writes, RTDB bandwidth, Auth. Free tier covers ~100 users; Blaze plan scales from there.*

---

### D. Key Takeaways

1. **AI commands are cheap.** At $0.004/command with Haiku + caching, this feature is viable to offer for free to all users. Even at 100K users, it's under $17K/month.

2. **Architecture diagrams are 10x more expensive per call** but used less frequently. The $0.045/analysis cost is manageable with Firestore caching reducing ~30% of calls to zero cost.

3. **Output tokens dominate Sonnet costs.** $1.47 of the $2.28 Sonnet spend during development was output tokens. Constraining output format and length is the highest-leverage optimization.

4. **Model selection matters enormously.** Migrating AI commands from Sonnet to Haiku (done on Feb 21) reduced per-command cost by ~4x with acceptable quality for tool-use tasks.

5. **Prompt caching is free money.** The system prompt (~2K tokens) and tool schemas (~3K tokens) are identical across calls. With Anthropic's prompt caching, these are charged at 90% discount after the first call, saving ~$0.004 per AI command.

6. **Infrastructure costs are negligible at small scale.** Firebase free tier and Vercel Hobby plan handle the first ~100 users with zero cost. AI API calls are the only meaningful expense.
