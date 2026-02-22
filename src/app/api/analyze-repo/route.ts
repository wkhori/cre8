import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { tmpdir } from "os";
import { join } from "path";
import { readFile, mkdtemp, rm } from "fs/promises";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase-client";
import { layoutArchitecture } from "@/lib/architecture-layout";
import { getLangfuse } from "@/lib/langfuse";
import type { ArchitectureAnalysis } from "@/lib/architecture-types";
import {
  AI_MODEL,
  MAX_PACKED_CHARS,
  CACHE_TTL_MS,
  ANALYSIS_PROMPT,
  ARCH_INCLUDE,
  ARCH_IGNORE,
  sanitizeIconSlugs,
} from "@/lib/architecture-config";

export const maxDuration = 60;

const CACHE_DISABLED = process.env.DISABLE_ARCH_CACHE === "true";

// ── Firestore cache helpers (keyed by owner_repo:sha) ───────────────
async function getCachedAnalysis(cacheKey: string): Promise<ArchitectureAnalysis | null> {
  if (CACHE_DISABLED) return null;
  try {
    const snap = await getDoc(doc(firebaseDb, "repo-cache", cacheKey));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.expiresAt < Date.now()) return null;
    return data.architecture as ArchitectureAnalysis;
  } catch {
    return null;
  }
}

async function setCachedAnalysis(cacheKey: string, architecture: ArchitectureAnalysis) {
  try {
    await setDoc(doc(firebaseDb, "repo-cache", cacheKey), {
      architecture,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  } catch (err) {
    console.warn("Failed to write cache:", err);
  }
}

async function getCommitSha(owner: string, repo: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/HEAD`, {
      headers: { Accept: "application/vnd.github.sha" },
    });
    if (!res.ok) return null;
    return (await res.text()).trim();
  } catch {
    return null;
  }
}

const RequestSchema = z.object({
  repoUrl: z.string().url(),
  viewportCenter: z.object({ x: z.number(), y: z.number() }).optional(),
});

async function packRepository(repoUrl: string): Promise<string> {
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
      include: ARCH_INCLUDE,
      ignore: ARCH_IGNORE,
      removeComments: true,
      removeEmptyLines: true,
      noFileSummary: true,
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
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
  return text;
}

// ── Streaming helpers ───────────────────────────────────────────────
const encoder = new TextEncoder();

function sendEvent(controller: ReadableStreamDefaultController, data: Record<string, unknown>) {
  controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
}

// ── POST handler (streaming NDJSON) ─────────────────────────────────
export async function POST(request: NextRequest) {
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

  const [, owner, repo] = ghMatch;
  const repoName = `${owner}/${repo}`;

  const stream = new ReadableStream({
    async start(controller) {
      const startMs = Date.now();
      const langfuse = getLangfuse();

      try {
        const trace = langfuse?.trace({
          name: "analyze-repo",
          input: { repoUrl, repoName, viewportCenter },
        });

        // ── Check cache ──────────────────────────────────────────
        sendEvent(controller, { phase: "resolving", message: "Resolving latest commit..." });

        const sha = await getCommitSha(owner, repo);
        const cacheKey = sha ? `${repoName}:${sha}` : null;

        if (cacheKey) {
          // Firestore doc IDs can't contain '/' — use '_' separator
          const docId = cacheKey.replace(/\//g, "_");
          const cachedArch = await getCachedAnalysis(docId);
          if (cachedArch) {
            // Cache hit — skip packing + Claude entirely
            sendEvent(controller, { phase: "cached", message: "Using cached analysis" });

            const cx = viewportCenter?.x ?? 400;
            const cy = viewportCenter?.y ?? 200;
            const operations = layoutArchitecture(cachedArch, cx - 300, cy - 200);
            const componentCount = cachedArch.layers.reduce(
              (s: number, l: { components: unknown[] }) => s + l.components.length,
              0
            );
            const durationMs = Date.now() - startMs;

            trace?.update({ output: { cached: true, durationMs } });
            langfuse?.flushAsync().catch(() => {});

            sendEvent(controller, {
              phase: "complete",
              data: {
                success: true,
                operations,
                message: `Generated architecture diagram for **${repoName}** (cached) — ${cachedArch.layers.length} layers, ${componentCount} components, ${cachedArch.connections.length} connections.`,
                durationMs,
              },
            });
            return;
          }
        }

        // ── Pack repository ──────────────────────────────────────
        sendEvent(controller, { phase: "packing", message: "Cloning & packing repository..." });

        const packSpan = trace?.span({ name: "pack-repository" });
        let packed: string;
        let packMethod = "repomix";
        try {
          packed = await packRepository(repoUrl);
        } catch (repomixError) {
          console.warn("Repomix failed, falling back to GitHub API:", repomixError);
          packMethod = "github-api";
          try {
            packed = await packRepositoryFallback(repoUrl);
          } catch (fallbackError) {
            const msg =
              fallbackError instanceof Error
                ? fallbackError.message
                : "Could not access repository.";
            packSpan?.end({ output: { error: msg } });
            sendEvent(controller, {
              phase: "complete",
              data: { success: false, error: msg, operations: [], message: "" },
            });
            return;
          }
        }
        packSpan?.end({ output: { method: packMethod, chars: packed.length } });

        // ── Claude analysis ──────────────────────────────────────
        sendEvent(controller, { phase: "analyzing", message: "AI is analyzing architecture..." });

        const generation = trace?.generation({
          name: "architecture-analysis",
          model: AI_MODEL,
          input: { packedChars: packed.length, repoName },
        });

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

        generation?.end({
          output: response.content,
          usage: { input: response.usage?.input_tokens, output: response.usage?.output_tokens },
        });

        const textBlock = response.content.find((b) => b.type === "text");
        if (!textBlock || textBlock.type !== "text") {
          trace?.update({ output: { error: "No text in response" } });
          sendEvent(controller, {
            phase: "complete",
            data: {
              success: false,
              error: "AI did not return an analysis.",
              operations: [],
              message: "",
            },
          });
          return;
        }

        // ── Parse architecture JSON ──────────────────────────────
        sendEvent(controller, { phase: "laying_out", message: "Building diagram layout..." });

        let architecture: ArchitectureAnalysis;
        try {
          const jsonStr = extractJSON(textBlock.text);
          architecture = JSON.parse(jsonStr) as ArchitectureAnalysis;
        } catch {
          console.error("Failed to parse architecture JSON:", textBlock.text.slice(0, 500));
          trace?.update({ output: { error: "JSON parse failure" } });
          sendEvent(controller, {
            phase: "complete",
            data: {
              success: false,
              error: "Failed to parse architecture analysis. Please try again.",
              operations: [],
              message: "",
            },
          });
          return;
        }

        if (!architecture.layers || architecture.layers.length === 0) {
          trace?.update({ output: { error: "No layers found" } });
          sendEvent(controller, {
            phase: "complete",
            data: {
              success: false,
              error: "Could not identify a clear architecture in this repository.",
              operations: [],
              message: "",
            },
          });
          return;
        }

        // ── Validate icon slugs (strip bad ones to prevent invisible gaps) ──
        await sanitizeIconSlugs(architecture);

        // ── Store in cache ───────────────────────────────────────
        if (cacheKey) {
          const docId = cacheKey.replace(/\//g, "_");
          setCachedAnalysis(docId, architecture); // fire-and-forget
        }

        // ── Layout engine ────────────────────────────────────────
        const cx = viewportCenter?.x ?? 400;
        const cy = viewportCenter?.y ?? 200;
        const operations = layoutArchitecture(architecture, cx - 300, cy - 200);

        const componentCount = architecture.layers.reduce((s, l) => s + l.components.length, 0);
        const durationMs = Date.now() - startMs;
        const message = `Generated architecture diagram for **${repoName}** — ${architecture.layers.length} layers, ${componentCount} components, ${architecture.connections.length} connections.`;

        trace?.update({
          output: {
            layers: architecture.layers.length,
            components: componentCount,
            connections: architecture.connections.length,
            operations: operations.length,
            durationMs,
          },
        });
        langfuse?.flushAsync().catch(() => {});

        sendEvent(controller, {
          phase: "complete",
          data: { success: true, operations, message, durationMs },
        });
      } catch (err) {
        console.error("analyze-repo error:", err);
        const msg = err instanceof Error ? err.message : "Internal error";
        sendEvent(controller, {
          phase: "complete",
          data: { success: false, error: msg, operations: [], message: "" },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    },
  });
}
