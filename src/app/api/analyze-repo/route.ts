import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { tmpdir } from "os";
import { join } from "path";
import { readFile, mkdtemp, rm } from "fs/promises";
import { layoutArchitecture } from "@/lib/architecture-layout";
import type { ArchitectureAnalysis } from "@/lib/architecture-types";

export const maxDuration = 60;

const AI_MODEL = "claude-sonnet-4-6";
const MAX_PACKED_CHARS = 150_000;

const RequestSchema = z.object({
  repoUrl: z.string().url(),
  viewportCenter: z.object({ x: z.number(), y: z.number() }).optional(),
});

// ── Common Simple Icons slugs reference for Claude ──────────────────
const ICON_SLUG_REFERENCE = `
Common Simple Icons slugs (use these exact values for iconSlug):
react, nextdotjs, vuedotjs, angular, svelte, astro, nuxtdotjs, gatsby,
nodedotjs, express, fastify, nestjs, hono, bun, deno,
typescript, javascript, python, go, rust, java, ruby, php, swift, kotlin, cplusplus, csharp,
postgresql, mysql, mongodb, redis, sqlite, supabase, firebase, prisma, drizzle,
docker, kubernetes, nginx, vercel, netlify, amazonwebservices, googlecloud, microsoftazure,
graphql, trpc, tailwindcss, sass, vite, webpack, turborepo, pnpm, npm,
git, github, gitlab, jest, vitest, cypress, playwright,
figma, storybook, electron, tauri, flutter, reactnative,
openai, anthropic, langchain, huggingface,
stripe, auth0, clerk, sentry, datadog,
linux, ubuntu, apple, windows, android,
`.trim();

// ── Architecture analysis prompt ────────────────────────────────────
const ANALYSIS_PROMPT = `You are a senior software architect. Analyze the following codebase and produce a structured architecture description as JSON.

RULES:
- Identify 2-5 logical layers/tiers (e.g., "Client / Frontend", "API Layer", "Backend Services", "Data / Infrastructure")
- Assign tier numbers starting from 0 (client-facing) going deeper
- Identify 2-7 major components per layer (max ~25 total across all layers)
- Each component should map to a real module, service, or package in the codebase
- For each component, provide an iconSlug from Simple Icons if a well-known technology is used
- Identify key connections showing data flow between components
- Focus on ARCHITECTURE, not individual files — group related files into logical components

${ICON_SLUG_REFERENCE}

OUTPUT FORMAT — Return ONLY valid JSON, no markdown fences, no explanation:
{
  "title": "Project Name — Architecture",
  "description": "One-line summary of what this project does",
  "layers": [
    {
      "name": "Layer Display Name",
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
- Keep connections to 5-15 total (most important relationships only)`;

// ── Pack repository with repomix ────────────────────────────────────
async function packRepository(repoUrl: string): Promise<string> {
  // Dynamic import to avoid bundling issues
  const { runCli } = await import("repomix");

  const tempDir = await mkdtemp(join(tmpdir(), "cre8-repo-"));
  const outputFile = join(tempDir, "output.txt");

  try {
    await runCli(["."], tempDir, {
      remote: repoUrl,
      output: outputFile,
      style: "plain",
      compress: true,
      quiet: true,
    } as Parameters<typeof runCli>[2]);

    const content = await readFile(outputFile, "utf-8");

    if (content.length > MAX_PACKED_CHARS) {
      return (
        content.slice(0, MAX_PACKED_CHARS) +
        "\n\n[TRUNCATED — repository too large to analyze fully]"
      );
    }

    return content;
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Fallback: GitHub API ────────────────────────────────────────────
async function packRepositoryFallback(repoUrl: string): Promise<string> {
  const match = repoUrl.match(/github\.com\/([\w.-]+)\/([\w.-]+)/);
  if (!match) throw new Error("Invalid GitHub URL");
  const [, owner, repo] = match;

  // Fetch file tree
  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
    { headers: { Accept: "application/vnd.github.v3+json" } }
  );
  if (!treeRes.ok) {
    throw new Error(
      treeRes.status === 404
        ? "Repository not found. Make sure it's a public GitHub repo."
        : `GitHub API error: ${treeRes.status}`
    );
  }
  const tree = await treeRes.json();

  // Select important files
  const importantPatterns = [
    /README\.md$/i,
    /package\.json$/,
    /tsconfig/,
    /Cargo\.toml$/,
    /go\.mod$/,
    /requirements\.txt$/,
    /pyproject\.toml$/,
    /src\/.*\.(ts|tsx|js|jsx)$/,
    /app\/.*\.(ts|tsx|js|jsx)$/,
    /lib\/.*\.(ts|tsx)$/,
    /pages\/.*\.(ts|tsx|js|jsx)$/,
  ];

  const files = (tree.tree as Array<{ path: string; type: string }>)
    .filter((f) => f.type === "blob" && importantPatterns.some((p) => p.test(f.path)))
    .slice(0, 40);

  // Fetch file contents in parallel
  const contents = await Promise.all(
    files.map(async (f) => {
      try {
        const res = await fetch(
          `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${f.path}`
        );
        if (!res.ok) return `=== ${f.path} ===\n[Could not fetch]\n`;
        const text = await res.text();
        return `=== ${f.path} ===\n${text.slice(0, 3000)}\n`;
      } catch {
        return `=== ${f.path} ===\n[Error fetching]\n`;
      }
    })
  );

  const allPaths = (tree.tree as Array<{ path: string }>).map((f) => f.path).join("\n");

  return `Repository: ${owner}/${repo}\n\nFile tree:\n${allPaths}\n\n${contents.join("\n")}`;
}

// ── Extract JSON from Claude response ───────────────────────────────
function extractJSON(text: string): string {
  // Try to find JSON in markdown code fences first
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();

  // Try to find raw JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];

  return text;
}

// ── POST handler ────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const startMs = Date.now();

  try {
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request. Provide a valid GitHub URL.",
          operations: [],
          message: "",
        },
        { status: 400 }
      );
    }

    const { repoUrl, viewportCenter } = parsed.data;

    // Validate it's a GitHub URL
    const ghMatch = repoUrl.match(/github\.com\/([\w.-]+)\/([\w.-]+)/);
    if (!ghMatch) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please provide a valid GitHub repository URL (e.g., https://github.com/owner/repo).",
          operations: [],
          message: "",
        },
        { status: 400 }
      );
    }

    // Pack the repository
    let packed: string;
    try {
      packed = await packRepository(repoUrl);
    } catch (repomixError) {
      // Fallback to GitHub API if repomix fails
      console.warn("Repomix failed, falling back to GitHub API:", repomixError);
      try {
        packed = await packRepositoryFallback(repoUrl);
      } catch (fallbackError) {
        const msg =
          fallbackError instanceof Error ? fallbackError.message : "Could not access repository.";
        return NextResponse.json(
          { success: false, error: msg, operations: [], message: "" },
          { status: 400 }
        );
      }
    }

    // Send to Claude for architecture analysis
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 4096,
      system: ANALYSIS_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analyze this codebase and produce the architecture JSON:\n\n${packed}`,
        },
      ],
    });

    // Extract text response
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { success: false, error: "AI did not return an analysis.", operations: [], message: "" },
        { status: 500 }
      );
    }

    // Parse architecture JSON
    let architecture: ArchitectureAnalysis;
    try {
      const jsonStr = extractJSON(textBlock.text);
      architecture = JSON.parse(jsonStr) as ArchitectureAnalysis;
    } catch {
      console.error("Failed to parse architecture JSON:", textBlock.text.slice(0, 500));
      return NextResponse.json(
        {
          success: false,
          error: "Failed to parse architecture analysis. Please try again.",
          operations: [],
          message: "",
        },
        { status: 500 }
      );
    }

    // Validate minimum structure
    if (!architecture.layers || architecture.layers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Could not identify a clear architecture in this repository.",
          operations: [],
          message: "",
        },
        { status: 400 }
      );
    }

    // Run layout engine
    const cx = viewportCenter?.x ?? 400;
    const cy = viewportCenter?.y ?? 200;
    // Offset so diagram appears centered-ish in viewport
    const baseX = cx - 300;
    const baseY = cy - 200;

    const operations = layoutArchitecture(architecture, baseX, baseY);

    const repoName = `${ghMatch[1]}/${ghMatch[2]}`;
    const componentCount = architecture.layers.reduce((sum, l) => sum + l.components.length, 0);
    const message = `Generated architecture diagram for **${repoName}** — ${architecture.layers.length} layers, ${componentCount} components, ${architecture.connections.length} connections.`;

    return NextResponse.json({
      success: true,
      operations,
      message,
      durationMs: Date.now() - startMs,
    });
  } catch (err) {
    console.error("analyze-repo error:", err);
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json(
      { success: false, error: msg, operations: [], message: "" },
      { status: 500 }
    );
  }
}
