// ── Architecture analysis configuration ──────────────────────────────
// Constants and helpers for the repo→architecture-diagram pipeline.

export const AI_MODEL = "claude-sonnet-4-6";
export const MAX_PACKED_CHARS = 60_000;
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Icon slug instruction for Claude ─────────────────────────────────
const ICON_SLUG_REFERENCE = `Use Simple Icons slugs (simpleicons.org) for iconSlug/techStackIcons. ONLY use slugs you are confident exist — omit iconSlug entirely if unsure. Common mappings: Next.js="nextdotjs", Node.js="nodedotjs", Vue.js="vuedotjs", Nuxt.js="nuxtdotjs", C++="cplusplus", C#="csharp", AWS="amazonwebservices", GitHub="github", VS Code="visualstudiocode", Prettier="prettier", ESLint="eslint". Most others match the lowercase brand name with no spaces. If the technology doesn't have a well-known icon, leave iconSlug out.`;

// ── Architecture analysis prompt ────────────────────────────────────
export const ANALYSIS_PROMPT = `You are a senior software architect. Analyze the following codebase and produce a structured architecture description as JSON.

ANALYSIS RULES:
- Identify 2-5 logical layers or groups. They do NOT have to be traditional client/server tiers.
  - If the project has distinct feature modules, group by feature area instead.
  - If it's a monolith, group by concern (UI, state, data, services, utilities).
  - If it has separate packages/workspaces, group by package.
- Assign tier numbers (0 = top/client-facing, higher = deeper). Use the same tier number for groups that sit side-by-side at the same level.
- Identify 2-5 major components per layer (max 5 per layer, ~20 total across all layers). If a layer has more than 5 components, split into two layers at the same tier.
- Each component should map to a real module, service, or package in the codebase.
- For each component, provide an iconSlug from Simple Icons if a well-known technology is used.
- Identify 5-12 key connections showing data flow between components. Add a short label describing the relationship.
- Provide a 3-5 sentence "summary" explaining what the project does, its key architectural decisions, and notable patterns.
- Provide "techStackIcons": an array of 4-8 Simple Icons slugs for the project's main technologies.

${ICON_SLUG_REFERENCE}

OUTPUT FORMAT — Return ONLY valid JSON, no markdown fences, no explanation:
{
  "title": "Project Name — Architecture",
  "description": "One-line summary of what this project does",
  "summary": "3-5 sentence architectural overview. Describe the project purpose, key architectural patterns, data flow approach, and notable design decisions.",
  "techStackIcons": ["react", "typescript", "firebase", "tailwindcss"],
  "layers": [
    {
      "name": "Layer or Group Name",
      "tier": 0,
      "components": [
        {
          "id": "unique-kebab-id",
          "name": "Display Name",
          "description": "What this component does (8 words max)",
          "techStack": "Key tech (e.g. Next.js, React)",
          "iconSlug": "nextdotjs"
        }
      ]
    }
  ],
  "connections": [
    {
      "from": "component-id-a",
      "to": "component-id-b",
      "label": "REST API",
      "style": "arrow",
      "lineStyle": "solid"
    }
  ]
}

CONNECTION RULES:
- "arrow" for directed data flow, "double-arrow" for bidirectional, "line" for loose coupling
- "dashed" lineStyle for async/event-driven, "dotted" for optional, "solid" for synchronous
- Every "from" and "to" must reference a valid component "id"
- Always include a short "label" describing the connection (e.g. "REST API", "imports", "subscribes", "WebSocket", "queries")
- Keep connections to the most important 5-12 relationships

LAYOUT HINTS:
- Not every architecture is a top-down waterfall. Feel free to use the same tier number for groups that are peers/siblings.
- Group related infrastructure together (e.g. "Data / Infrastructure" layer for DB + cache + auth).
- If the project has a clear feature-based structure, reflect that in the grouping.`;

// ── Repomix include globs (architecture-relevant files only) ─────────
export const ARCH_INCLUDE = [
  // ── Manifest / dependency files (highest signal-per-byte) ──
  "package.json",
  "tsconfig*.json",
  "Cargo.toml",
  "go.mod",
  "pyproject.toml",
  "requirements.txt",
  "setup.py",
  "setup.cfg",
  "Gemfile",
  "pom.xml",
  "build.gradle*",
  "*.csproj",
  "*.sln",
  "mix.exs",
  "Package.swift",

  // ── Framework / build config ──
  "next.config.*",
  "vite.config.*",
  "webpack.config.*",
  "nuxt.config.*",
  "svelte.config.*",
  "astro.config.*",
  "angular.json",
  "nest-cli.json",
  "turbo.json",
  "nx.json",
  "lerna.json",

  // ── Infrastructure / deploy ──
  "docker-compose*.yml",
  "Dockerfile*",
  "serverless.yml",
  "wrangler.toml",
  "firebase.json",
  "supabase/config.toml",
  "Makefile",
  "Procfile",
  ".github/workflows/*.yml",

  // ── Data / schema (reveals data model) ──
  "prisma/schema.prisma",
  "drizzle.config.*",
  "**/schema.{ts,js,py,rb}",
  "**/models/*.{ts,js,py,rb,go,rs,java}",
  "**/migrations/*.sql",

  // ── Docs ──
  "README.md",
  ".env.example",

  // ── Source code (all major languages) ──
  "src/**/*.{ts,tsx,js,jsx,py,go,rs,java,rb,cs,ex,exs,swift,kt}",
  "app/**/*.{ts,tsx,js,jsx,py,rb}",
  "lib/**/*.{ts,tsx,js,jsx,rb}",
  "pages/**/*.{ts,tsx,js,jsx,vue}",
  "server/**/*.{ts,tsx,js,jsx}",
  "api/**/*.{ts,tsx,js,jsx,py}",
  "routes/**/*.{ts,tsx,js,jsx}",
  "components/**/*.{ts,tsx,js,jsx,vue,svelte}",
  "middleware/**/*.{ts,js}",
  "cmd/**/*.go",
  "internal/**/*.go",
  "pkg/**/*.go",
  "crates/*/src/**/*.rs",
  "config/**/*.{ts,js,py,rb}",

  // ── Monorepo ──
  "packages/*/package.json",
  "packages/*/src/index.{ts,tsx,js}",
  "services/*/package.json",
  "apps/*/package.json",
].join(",");

// ── Repomix ignore globs (noise for architecture analysis) ──────────
export const ARCH_IGNORE = [
  // ── Test files ──
  "**/*.test.*",
  "**/*.spec.*",
  "**/__tests__/**",
  "**/*.stories.*",
  "**/fixtures/**",
  "**/__mocks__/**",
  "**/test/**",
  "**/tests/**",
  "**/*.e2e.*",
  "**/cypress/**",
  "**/playwright/**",

  // ── Type declarations ──
  "**/*.d.ts",

  // ── Build output ──
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/out/**",
  "**/target/**",
  "**/.turbo/**",
  "**/.vercel/**",
  "**/.serverless/**",
  "**/storybook-static/**",

  // ── Dependencies / caches ──
  "**/node_modules/**",
  "**/vendor/**",
  "**/__pycache__/**",
  "**/*.pyc",
  "**/venv/**",
  "**/.venv/**",
  "**/*.egg-info/**",
  "**/coverage/**",

  // ── Generated / minified ──
  "**/*.min.*",
  "**/*.map",
  "**/generated/**",
  "**/*.generated.*",

  // ── Lock files ──
  "**/*.lock",
  "**/package-lock.json",
  "**/yarn.lock",
  "**/pnpm-lock.yaml",
  "**/Gemfile.lock",
  "**/poetry.lock",
  "**/Cargo.lock",
  "**/go.sum",
].join(",");
