import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";

let adapter: typeof import("@/lib/offline/adapter");
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("navigator", { onLine: true });
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
  fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, synced: 1 })));
  vi.stubGlobal("fetch", fetchMock);
  adapter = await import("@/lib/offline/adapter");
});
afterEach(() => vi.unstubAllGlobals());
const enqueue = async (id = "queue-set-1", sessionId = "workout-1") => adapter.enqueueOperation({ clientId: id, kind: "workout_set", endpoint: "/api/workouts/sync", payload: { clientId: id, sessionId, reps: 8 } });

async function storedOp(clientId: string) {
  return new Promise<{ status: string; attempts: number } | undefined>((resolve, reject) => {
    const open = indexedDB.open("esifit-offline", 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const read = db.transaction("ops").objectStore("ops").get(clientId);
      read.onsuccess = () => { resolve(read.result); db.close(); };
      read.onerror = () => reject(read.error);
    };
  });
}

describe("durable queue terminal and transient outcomes", () => {
  it.each([400, 403, 404, 409, 410, 422])("parks permanent HTTP %s without repeated writes", async status => {
    await enqueue(); fetchMock.mockResolvedValue(new Response("{}", { status }));
    await adapter.syncQueue(); await adapter.syncQueue();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await storedOp("queue-set-1")).toMatchObject({ status: "conflict" });
    expect(await adapter.queuedCount()).toBe(0);
    await expect(adapter.syncWorkoutBeforeComplete("workout-1")).rejects.toMatchObject({ code: "conflict", canFinishSavedSets: true });
    await expect(adapter.syncWorkoutBeforeComplete("workout-1", true)).resolves.toBeUndefined();
    expect(await storedOp("queue-set-1")).toMatchObject({ status: "conflict" });
  });
  it.each([401, 408, 425, 429, 500])("preserves HTTP %s for later retry without burning attempts", async status => {
    await enqueue(); fetchMock.mockResolvedValue(new Response("{}", { status }));
    await adapter.syncQueue();
    expect(await adapter.queuedCount()).toBe(1);
    expect((await storedOp("queue-set-1"))?.attempts).toBe(0);
  });
  it("never deletes a set on network errors or a malformed successful response", async () => {
    await enqueue(); fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    await adapter.syncQueue();
    fetchMock.mockResolvedValueOnce(new Response("not-json")); await adapter.syncQueue();
    expect(await adapter.queuedCount()).toBe(1);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, synced: 1 })));
    await adapter.syncWorkoutBeforeComplete("workout-1");
    expect(await storedOp("queue-set-1")).toBeUndefined();
  });
  it("blocks offline completion but unrelated water does not block a saved workout", async () => {
    await enqueue(); vi.stubGlobal("navigator", { onLine: false });
    await expect(adapter.syncWorkoutBeforeComplete("workout-1", true)).rejects.toMatchObject({ code: "conflict", canFinishSavedSets: false });
    await expect(adapter.syncWorkoutBeforeComplete("another-workout")).resolves.toBeUndefined();
    await adapter.enqueueOperation({ clientId: "water-op", kind: "water", endpoint: "/api/water", payload: { ml: 250 } });
    await expect(adapter.syncWorkoutBeforeComplete("another-workout")).resolves.toBeUndefined();
  });
  it("waits for an in-flight set and drains sets added during that pass", async () => {
    await enqueue();
    let release!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { release = resolve; }));
    const first = adapter.syncQueue();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await enqueue("queue-set-2");
    const finish = adapter.syncWorkoutBeforeComplete("workout-1");
    release(new Response(JSON.stringify({ ok: true, synced: 1 })));
    await Promise.all([first, finish]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await adapter.queuedCount()).toBe(0);
  });
  it("fails closed when persistence cannot be read", async () => {
    vi.stubGlobal("indexedDB", undefined);
    await expect(adapter.syncWorkoutBeforeComplete("workout-1")).rejects.toThrow("no-indexeddb");
  });
  it("finishes a crash-interrupted logout purge before exposing old data", async () => {
    await enqueue(); await adapter.cachePut("dashboard", { secret: "previous-account" });
    localStorage.setItem("esifit:offline-purge-pending", "1");
    vi.resetModules(); const reopened = await import("@/lib/offline/adapter");
    expect(await reopened.getQueuedOperations()).toEqual([]);
    expect(await reopened.cacheGet("dashboard")).toBeNull();
    expect(localStorage.getItem("esifit:offline-purge-pending")).toBeNull();
  });
});
