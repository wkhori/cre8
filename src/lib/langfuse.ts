import { Langfuse } from "langfuse";

let langfuseInstance: Langfuse | null = null;

/**
 * Returns a singleton LangFuse client, or null if env vars are missing.
 * Safe to call in any environment — gracefully degrades to no-op.
 */
export function getLangfuse(): Langfuse | null {
  if (langfuseInstance) return langfuseInstance;

  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;

  if (!publicKey || !secretKey) {
    return null;
  }

  langfuseInstance = new Langfuse({
    publicKey,
    secretKey,
    baseUrl: process.env.LANGFUSE_BASEURL || "https://cloud.langfuse.com",
  });

  return langfuseInstance;
}
