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
- Identify 3-7 logical layers or groups. They do NOT have to be traditional client/server tiers.
  - If the project has distinct feature modules, group by feature area instead.
  - If it's a monolith, group by concern (UI, state, data, services, utilities).
  - If it has separate packages/workspaces, group by package.
- Assign tier numbers (0 = top/client-facing, higher = deeper). Use the same tier number for groups that sit side-by-side at the same level.
- Identify 2-5 major components per layer (max 5 per layer, ~20 total across all layers).
- Each component should map to a real module, service, or package in the codebase.

COMPONENT FIELDS:
- "name": Short display name (2-4 words max, e.g., "Canvas Stage", "Auth Provider").
- "techStack": The PRIMARY technology for this component as a SHORT label (1-3 words, e.g., "React Konva", "Zustand", "Firestore"). Every component should have one. Do NOT repeat the same tech on every component — only the primary one unique to that component.
- "iconSlug": Simple Icons slug for the primary technology. Every component with a well-known tech should have this.
- "description": OMIT THIS FIELD. Do NOT include per-component descriptions. The layer "description" field covers this.

LAYER FIELDS:
- "name": Short group name (e.g., "Canvas UI", "State Management", "API Routes").
- "description": ONE short sentence (8-15 words max) explaining what this layer handles. Examples:
  - "Renders shapes and handles user interaction on the canvas"
  - "Manages application state and syncs with backend"
  - "Processes AI commands and streams results to client"
  This is displayed as a subtitle in the layer header. Keep it punchy and informative.
- "tier": Number (0 = top/client-facing, higher = deeper).
- "section": Required. Groups related layers visually.

SECTION RULES:
- EVERY layer MUST have a "section" string.
- Use 2-4 sections. Common patterns:
  - "Frontend" + "Backend" + "Infrastructure" (classic web app)
  - "Client" + "Server" + "Data" (API-centric)
  - "Core" + "Features" + "Platform" (modular monolith)
- Layers within a section don't need sequential tier numbers.
- Think of sections as major subsystems a developer would mentally group together.

COLOR THEME:
- Choose a "colorTheme" based on the project's character:
  - "warm" — creative tools, social apps, content platforms
  - "cool" — enterprise, dashboards, productivity tools
  - "earth" — data/ML, scientific, analytics
  - "neon" — dev tools, CLIs, developer-facing projects
  - "ocean" — cloud infrastructure, networking, DevOps
  - "mono" — minimal projects, libraries, utilities

LAYOUT HINT:
- Choose a "layoutHint" based on the project's topology:
  - "vertical" — simple projects with clear top-down data flow. Sections stack top to bottom.
  - "horizontal" — projects with a clear frontend/backend split. Sections sit side by side.
  - "bento" (default) — complex projects where sections have different sizes. Dynamic grid layout.

${ICON_SLUG_REFERENCE}

OUTPUT FORMAT — Return ONLY valid JSON, no markdown fences, no explanation:
{
  "title": "<actual repo name> — Architecture",
  "description": "One-line summary of what this project does",
  "summary": "3-5 sentence architectural overview.",
  "techStackIcons": ["react", "typescript", "firebase", "tailwindcss"],
  "colorTheme": "cool",
  "layoutHint": "bento",
  "layers": [
    {
      "name": "Canvas UI",
      "description": "Renders shapes and handles user interaction on the canvas",
      "tier": 1,
      "section": "Frontend",
      "components": [
        {
          "id": "canvas-stage",
          "name": "Canvas Stage",
          "techStack": "React Konva",
          "iconSlug": "react"
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
      "lineStyle": "solid",
      "importance": "primary"
    }
  ]
}

CONNECTION RULES — LESS IS MORE:
- MAXIMUM 2-4 connections total. Only show connections that reveal non-obvious, cross-section relationships.
- If a relationship is obvious from the section grouping (e.g., frontend calls backend), do NOT add a connector.
- "arrow" for directed data flow, "double-arrow" for bidirectional, "line" for loose coupling
- "dashed" lineStyle for async/event-driven, "dotted" for optional, "solid" for synchronous
- Every "from" and "to" must reference a valid component "id"
- Always include a short "label" (2-4 words max)
- Classify each connection by importance:
  - "primary" (1-2): The single most critical data flow path
  - "secondary" (1-2): Important supporting relationships
  - "tertiary" (0-1): Nice-to-know, rendered faintly
- ONLY connect components within the SAME section or between directly adjacent sections.

LAYOUT TIPS:
- Use the same tier number for peer groups that sit side-by-side.
- Group related infrastructure together.
- A layer with 1-2 components is a thin row; 4-5 components is a major subsystem.
- Within a section, order layers from highest tier (user-facing) to lowest (infrastructure).`;

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
