import { describe, expect, it, vi, afterEach } from "vitest";
import { normalizeProviderUrl } from "@/lib/ai/provider-config";
import { encryptProviderKey, decryptProviderKey } from "@/lib/ai/secrets";
import { isPublicAddress, providerFetch } from "@/lib/ai/transport";
import { configuredModel, probeProvider } from "@/lib/ai/provider";
import { authorizeAction } from "@/lib/ai/actions";
import { assistantPrompt } from "@/lib/ai/prompt";
import type { SessionUser } from "@/lib/auth/session";

afterEach(() => vi.restoreAllMocks());
describe("Nex-compatible provider addressing", () => {
  it.each([
    "https://gw.example",
    "https://gw.example/",
    "https://gw.example/v1beta",
    "https://gw.example/v1beta/",
    "https://gw.example/v1beta/models",
  ])("normalizes Gemini %s", (url) => {
    expect(normalizeProviderUrl("gemini", url)).toBe(
      "https://gw.example/v1beta",
    );
  });
  it("preserves gateway prefixes and custom full chat endpoint", () => {
    expect(
      normalizeProviderUrl("gemini", "https://gw.example/google/v1beta/models"),
    ).toBe("https://gw.example/google/v1beta");
    expect(
      normalizeProviderUrl(
        "custom",
        "https://gw.example/openai/v1/chat/completions",
      ),
    ).toBe("https://gw.example/openai/v1");
    expect(normalizeProviderUrl("gemini", "")).toBe(
      "https://generativelanguage.googleapis.com/v1beta",
    );
  });
  it.each([
    "http://gw.example",
    "https://user:pass@gw.example",
    "https://gw.example?key=secret",
    "https://gw.example/#x",
    "https://gw.example:8080",
  ])("rejects unsafe URL %s", (url) => {
    expect(() => normalizeProviderUrl("custom", url)).toThrow();
  });
});
describe("provider trust boundaries", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.2",
    "172.16.0.1",
    "192.168.0.2",
    "169.254.169.254",
    "100.64.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "0.0.0.0",
  ])("blocks non-public IP %s", (ip) =>
    expect(isPublicAddress(ip)).toBe(false),
  );
  it("permits public addresses and rejects destination changes", async () => {
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    await expect(
      providerFetch("https://gw.example/v1")("https://other.example/v1"),
    ).rejects.toThrow();
    await expect(
      providerFetch("https://127.0.0.1/v1")("https://127.0.0.1/v1"),
    ).rejects.toThrow();
  });
  it("encrypts with unique nonces and authenticates the ciphertext", () => {
    const a = encryptProviderKey("secret-key"),
      b = encryptProviderKey("secret-key");
    expect(a).not.toContain("secret-key");
    expect(a).not.toBe(b);
    expect(decryptProviderKey(a)).toBe("secret-key");
    const parts = a.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptProviderKey(parts.join("."))).toThrow();
  });
  it("keeps capabilities scoped to the authenticated role", () => {
    expect(() => authorizeAction("member", "grant_ai")).toThrow();
    expect(() => authorizeAction("coach", "update_user")).toThrow();
    expect(() => authorizeAction("admin", "update_user")).not.toThrow();
    expect(() => authorizeAction("coach", "assign_plan")).not.toThrow();
    const prompt = assistantPrompt({
      role: "coach",
      displayName: "نام",
      timezone: "Asia/Tehran",
    } as SessionUser);
    expect(prompt).toContain("همپا");
    expect(prompt).toContain("coach");
    expect(prompt).toContain("فقط در محدوده");
  });
});

// Wire-level fixtures port the important Nex contracts without sending any real credentials.
vi.mock("@/lib/ai/transport", async (original) => {
  const actual = await original<typeof import("@/lib/ai/transport")>();
  return { ...actual, providerFetch: vi.fn(actual.providerFetch) };
});
describe("provider protocol contracts", () => {
  it.each(["gemini", "custom"] as const)(
    "tests a real SDK tool round trip for %s",
    async (kind) => {
      const mockFetch = vi.fn<typeof fetch>(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        if (kind === "gemini") {
          expect(new Headers(init?.headers).get("x-goog-api-key")).toBe(
            "fixture-only",
          );
          expect(body.contents[0].parts[0].text).toContain("connection_check");
          return Response.json({
            candidates: [
              {
                content: {
                  role: "model",
                  parts: [
                    {
                      functionCall: {
                        name: "connection_check",
                        args: { token: "ESIFIT_OK" },
                      },
                    },
                  ],
                },
                finishReason: "STOP",
              },
            ],
          });
        }
        expect(new Headers(init?.headers).get("Authorization")).toBe(
          "Bearer fixture-only",
        );
        expect(body.messages[0].content).toContain("connection_check");
        return Response.json({
          id: "test",
          object: "chat.completion",
          created: 0,
          model: "fixture",
          choices: [
            {
              index: 0,
              finish_reason: "tool_calls",
              message: {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "call1",
                    type: "function",
                    function: {
                      name: "connection_check",
                      arguments: '{"token":"ESIFIT_OK"}',
                    },
                  },
                ],
              },
            },
          ],
        });
      });
      vi.mocked(providerFetch).mockReturnValueOnce(mockFetch);
      await probeProvider({
        kind,
        baseUrl:
          kind === "gemini"
            ? "https://gw.example/google/v1beta"
            : "https://gw.example/openai/v1/chat/completions",
        model: "fixture",
        encryptedKey: encryptProviderKey("fixture-only"),
      });
      expect(String(mockFetch.mock.calls[0][0])).toBe(
        kind === "gemini"
          ? "https://gw.example/google/v1beta/models/fixture:generateContent"
          : "https://gw.example/openai/v1/chat/completions",
      );
    },
  );
  it("does not accept an HTTP 200 with no function call as a successful probe", async () => {
    vi.mocked(providerFetch).mockReturnValueOnce(async () =>
      Response.json({
        candidates: [
          {
            content: { role: "model", parts: [{ text: "OK" }] },
            finishReason: "STOP",
          },
        ],
      }),
    );
    await expect(
      probeProvider({
        kind: "gemini",
        baseUrl: "https://gw.example",
        model: "fixture",
        encryptedKey: encryptProviderKey("fixture"),
      }),
    ).rejects.toThrow();
  });
});
