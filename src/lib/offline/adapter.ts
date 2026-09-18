"use client";

/**
 * Offline-first persistence adapter — TECH_ARCHITECTURE §6.
 * UI components never touch IndexedDB directly; this is the boundary.
 * - Local write first, explicit sync state (local|syncing|synced|conflict|failed)
 * - Stable client-generated IDs, idempotent replay on the server
 * - Sync queue drained on reconnect; failed ops stay queued (never lost)
 */

export type SyncStatus = "local" | "syncing" | "synced" | "conflict" | "failed";

export type QueuedOperation = {
  clientId: string;
  kind: "workout_set" | "water";
  endpoint: string;
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  status: SyncStatus;
};

const DB_NAME = "esifit-offline";
const STORE_OPS = "ops";
const STORE_CACHE = "cache";
const MAX_ATTEMPTS = 8;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("no-indexeddb"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_OPS)) {
          db.createObjectStore(STORE_OPS, { keyPath: "clientId" });
        }
        if (!db.objectStoreNames.contains(STORE_CACHE)) {
          db.createObjectStore(STORE_CACHE, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("idb-open-failed"));
    });
  }
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const request = fn(t.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("idb-tx-failed"));
      }),
  );
}

export function newClientId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

// ---------------- Queue operations ----------------

export async function enqueueOperation(
  op: Omit<QueuedOperation, "attempts" | "status" | "createdAt"> & { createdAt?: number },
): Promise<void> {
  await tx(STORE_OPS, "readwrite", (s) =>
    s.put({ createdAt: Date.now(), ...op, attempts: 0, status: "local" as SyncStatus }),
  );
  window.dispatchEvent(new CustomEvent("esifit:queue-changed"));
}

export async function getQueuedOperations(): Promise<QueuedOperation[]> {
  try {
    const all = await tx<QueuedOperation[]>(STORE_OPS, "readonly", (s) => s.getAll() as IDBRequest<QueuedOperation[]>);
    // "conflict" is terminal: the server has rejected the op for good (deleted
    // session, wrong account). Retrying it forever would pin the pending badge on.
    return all.filter((o) => o.status !== "synced" && o.status !== "conflict");
  } catch {
    return [];
  }
}

export async function queuedCount(): Promise<number> {
  const ops = await getQueuedOperations();
  return ops.length;
}

export async function markOpStatus(clientId: string, status: SyncStatus): Promise<void> {
  const op = await tx<QueuedOperation | undefined>(STORE_OPS, "readonly", (s) => s.get(clientId) as IDBRequest<QueuedOperation | undefined>);
  if (op) {
    await tx(STORE_OPS, "readwrite", (s) => s.put({ ...op, status, attempts: op.attempts + (status === "failed" ? 1 : 0) }));
    window.dispatchEvent(new CustomEvent("esifit:queue-changed"));
  }
}

async function removeOp(clientId: string): Promise<void> {
  await tx(STORE_OPS, "readwrite", (s) => s.delete(clientId));
}

// ---------------- Sync engine ----------------

let syncing = false;

export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  if (syncing || typeof navigator === "undefined" || !navigator.onLine) return { synced: 0, failed: 0 };
  syncing = true;
  window.dispatchEvent(new CustomEvent("esifit:sync-status", { detail: "syncing" }));
  let synced = 0;
  let failed = 0;
  try {
    const ops = await getQueuedOperations();
    // Group water ops into one idempotent batch; workout sets sync one endpoint.
    for (const op of ops) {
      if (op.attempts >= MAX_ATTEMPTS) {
        await markOpStatus(op.clientId, "conflict");
        failed++;
        continue;
      }
      try {
        const body = op.kind === "workout_set" ? { sets: [op.payload] } : op.payload;
        const res = await fetch(op.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
        });
        if (res.ok) {
          const json = (await res.json().catch(() => null)) as { synced?: number; conflicts?: number; failed?: number } | null;
          // Server reports per-op outcome in the batch response. Transient
          // failures must stay queued; conflicts are terminal.
          if (json && typeof json.failed === "number" && json.failed > 0) {
            await markOpStatus(op.clientId, "failed");
            failed++;
          } else if (json && typeof json.conflicts === "number" && json.conflicts > 0 && (json.synced ?? 0) === 0) {
            await markOpStatus(op.clientId, "conflict");
            failed++;
          } else {
            synced++;
            await removeOp(op.clientId);
          }
        } else if (res.status === 401 || res.status === 404 || res.status === 410) {
          // Auth/validity errors will not fix themselves — park as conflict
          await markOpStatus(op.clientId, "conflict");
          failed++;
        } else {
          await markOpStatus(op.clientId, "failed");
          failed++;
        }
      } catch {
        await markOpStatus(op.clientId, "failed");
        failed++;
      }
    }
  } finally {
    syncing = false;
    const remaining = await queuedCount();
    window.dispatchEvent(new CustomEvent("esifit:sync-status", { detail: remaining > 0 ? "failed" : "synced" }));
    window.dispatchEvent(new CustomEvent("esifit:queue-changed"));
  }
  return { synced, failed };
}

/** Cache-friendly local read-through for dashboard hydration while offline. */
export async function cachePut(key: string, value: unknown): Promise<void> {
  try {
    await tx(STORE_CACHE, "readwrite", (s) => s.put({ key, value, savedAt: Date.now() }));
  } catch {
    // storage unavailable — app still works online
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const row = await tx<{ key: string; value: T; savedAt: number } | undefined>(
      STORE_CACHE,
      "readonly",
      (s) => s.get(key) as IDBRequest<{ key: string; value: T; savedAt: number } | undefined>,
    );
    return row?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Drop every trace of the signed-in account from this device.
 * Called on sign-out: the queue and the read-through cache are per-device, so
 * without this the next person to sign in on the same browser would replay the
 * previous user's unsynced sets and read their cached dashboard.
 */
export async function clearLocalUserData(): Promise<void> {
  try {
    if (dbPromise) {
      const db = await dbPromise;
      db.close();
    }
  } catch {
    // already closed / never opened
  }
  dbPromise = null;

  await new Promise<void>((resolve) => {
    if (typeof indexedDB === "undefined") return resolve();
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });

  // Personalized HTML held by the service worker (see public/sw.js).
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "esifit:clear-private-cache" });
  } catch {
    // no service worker in this context
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("esifit:queue-changed"));
  }
}
