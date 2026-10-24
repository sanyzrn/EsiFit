import { z } from "zod";

export const providerInput = z
  .object({
    id: z.string().optional(),
    label: z.string().trim().min(1).max(60),
    kind: z.enum(["gemini", "custom"]),
    baseUrl: z.string().trim().max(500).default(""),
    model: z
      .string()
      .trim()
      .min(1)
      .max(150)
      .regex(/^[a-zA-Z0-9_.:/-]+$/),
    apiKey: z.string().trim().max(2000).optional(),
    enabled: z.boolean().default(true),
  })
  .strict();
export const grantInput = z
  .object({
    userId: z.string().min(1),
    providerId: z.string().min(1),
    enabled: z.boolean(),
    dailyLimit: z.number().int().min(0).max(1000),
    monthlyLimit: z.number().int().min(0).max(30000),
  })
  .strict();
export type ProviderInput = z.infer<typeof providerInput>;

/** Nex semantics: preserve gateway prefixes; strip a pasted version/resource suffix. */
export function normalizeProviderUrl(
  kind: "gemini" | "custom",
  input: string,
): string {
  let raw = input.trim().replace(/\/+$/, "");
  if (!raw && kind === "gemini")
    raw = "https://generativelanguage.googleapis.com";
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.port && url.port !== "443")
  ) {
    throw new Error(
      "آدرس باید HTTPS عمومی، بدون نام کاربری، پارامتر یا پورت اختصاصی باشد.",
    );
  }
  if (kind === "gemini") {
    url.pathname = url.pathname.replace(
      /\/v1(?:beta)?(?:\/models(?:\/[^/]+)?)?$/,
      "",
    );
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}/v1beta`;
  }
  url.pathname = url.pathname.replace(/\/(?:chat\/completions|models)$/, "");
  if (!url.pathname || url.pathname === "/") url.pathname = "/v1";
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}
