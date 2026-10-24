import "server-only";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, tool } from "ai";
import { z } from "zod";
import type { AiProvider } from "@prisma/client";
import { normalizeProviderUrl, type ProviderInput } from "./provider-config";
import { decryptProviderKey } from "./secrets";
import { providerFetch } from "./transport";
import { readInput, proposalInput } from "./tool-contracts";

export function configuredModel(
  config: Pick<AiProvider, "kind" | "baseUrl" | "model" | "encryptedKey">,
) {
  const apiKey = decryptProviderKey(config.encryptedKey);
  const baseURL = normalizeProviderUrl(
    config.kind as "gemini" | "custom",
    config.baseUrl,
  );
  const fetch = providerFetch(baseURL);
  return config.kind === "gemini"
    ? createGoogle({ apiKey, baseURL, fetch })(
        config.model.replace(/^models\//, ""),
      )
    : createOpenAICompatible({
        name: "esifit-custom",
        apiKey,
        baseURL,
        fetch,
      }).chatModel(config.model);
}

/** A real completion AND function-call round trip, not a non-empty HTTP 200. */
export async function probeProvider(
  config: Pick<AiProvider, "kind" | "baseUrl" | "model" | "encryptedKey">,
) {
  let called = false;
  const tools = {
    // Validate the exact schemas used by HamPa, with no mutating executors.
    read_esifit: tool({
      description: "Read EsiFit data",
      inputSchema: readInput,
    }),
    propose_change: tool({
      description: "Propose a reviewed EsiFit change",
      inputSchema: proposalInput,
    }),
    connection_check: tool({
      description: "Verify this connection",
      inputSchema: z.object({ token: z.literal("ESIFIT_OK") }),
      execute: async () => {
        called = true;
        return { ok: true };
      },
    }),
  };
  await generateText({
    model: configuredModel(config),
    tools,
    toolChoice: { type: "tool", toolName: "connection_check" },
    prompt: "Call connection_check with token ESIFIT_OK.",
    maxOutputTokens: 512,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(25000),
  });
  if (!called) throw new Error("Provider did not support tool calls");
}
export function safeProvider(provider: AiProvider) {
  const { encryptedKey: _secret, ...safe } = provider;
  return { ...safe, hasKey: Boolean(_secret) };
}
export function normalizedInput(input: ProviderInput) {
  return {
    ...input,
    baseUrl: normalizeProviderUrl(input.kind, input.baseUrl),
    model:
      input.kind === "gemini"
        ? input.model.replace(/^models\//, "")
        : input.model,
  };
}
