import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function worker() {
  const listeners: Record<string, (event: { request?: unknown; data?: unknown; respondWith?: unknown; waitUntil?: unknown }) => void> = {};
  const put = vi.fn().mockResolvedValue(undefined);
  const caches = { open: vi.fn().mockResolvedValue({ put }), match: vi.fn(), delete: vi.fn().mockResolvedValue(true) };
  const fetch = vi.fn();
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self: { location: { origin: "https://esifit.test" }, addEventListener: (type: string, fn: typeof listeners[string]) => { listeners[type] = fn; } },
    caches, fetch, URL, Response,
  });
  return { listeners, caches, fetch, put };
}

describe("service worker privacy and cache strategies (platform emulation)", () => {
  it("keeps APIs and writes outside cache interception", () => {
    const w = worker(); const respondWith = vi.fn();
    for (const request of [
      { url: "https://esifit.test/api/dashboard", method: "GET", mode: "cors" },
      { url: "https://esifit.test/api/dashboard", method: "GET", mode: "navigate" },
      { url: "https://esifit.test/api/workouts/sync", method: "POST", mode: "cors" },
    ]) w.listeners.fetch({ request, respondWith });
    expect(respondWith).not.toHaveBeenCalled(); expect(w.caches.open).not.toHaveBeenCalled();
  });
  it.each([200, 302, 500])("only caches successful nonredirected navigation, status %s", async status => {
    const w = worker();
    const response = new Response("page", { status });
    Object.defineProperty(response, "type", { value: "basic" });
    Object.defineProperty(response, "redirected", { value: status === 302 });
    w.fetch.mockResolvedValue(response);
    let result!: Promise<Response>;
    w.listeners.fetch({ request: { url: "https://esifit.test/dashboard", method: "GET", mode: "navigate" }, respondWith: (p: Promise<Response>) => { result = p; } });
    expect(await result).toBe(response);
    await Promise.resolve(); await Promise.resolve();
    expect(w.put).toHaveBeenCalledTimes(status === 200 ? 1 : 0);
  });
  it("uses the offline fallback when network and private page cache are absent", async () => {
    const w = worker(); const offline = new Response("offline");
    w.fetch.mockRejectedValue(new TypeError("offline"));
    w.caches.match.mockImplementation((key: unknown) => Promise.resolve(key === "/offline" ? offline : undefined));
    let result!: Promise<Response>;
    w.listeners.fetch({ request: { url: "https://esifit.test/dashboard", method: "GET", mode: "navigate" }, respondWith: (p: Promise<Response>) => { result = p; } });
    expect(await result).toBe(offline);
  });
  it("drops the personalized page cache on logout without deleting static assets", async () => {
    const w = worker(); let purge!: Promise<void>;
    w.listeners.message({ data: { type: "esifit:clear-private-cache" }, waitUntil: (p: Promise<void>) => { purge = p; } });
    await purge;
    expect(w.caches.delete).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/^esifit-v\d+-pages$/));
  });
});
