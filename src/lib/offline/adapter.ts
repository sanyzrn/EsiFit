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
// Survives a mobile browser killing the page mid-logout. The next DB open
// must clear all records before any cached workout or queued mutation is read.
const PURGE_PENDING_KEY = "esifit:offline-purge-pending";
/** Transient failures (offline, 5xx) never burn attempts; only server-reported op failures do. */
const MAX_ATTEMPTS = 20;

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
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        let pendingPurge = false;
        try {
          pendingPurge = localStorage.getItem(PURGE_PENDING_KEY) === "1";
        } catch {
          // Storage may be disabled; the logout path already attempted cleanup.
        }
        if (!pendingPurge) return resolve(db);

        // Make sign-out crash-safe: never give a new session old account data.
        try {
          const purgeTx = db.transaction([STORE_OPS, STORE_CACHE], "readwrite");
          purgeTx.objectStore(STORE_OPS).clear();
          purgeTx.objectStore(STORE_CACHE).clear();
          purgeTx.oncomplete = () => {
            try { localStorage.removeItem(PURGE_PENDING_KEY); } catch { /* storage unavailable */ }
            resolve(db);
          };
          purgeTx.onerror = () => reject(purgeTx.error ?? new Error("offline-purge-failed"));
          purgeTx.onabort = () => reject(purgeTx.error ?? new Error("offline-purge-aborted"));
        } catch (error) {
          reject(error);
        }
      };
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
        if (mode === "readwrite") {
          // Resolve on commit, not on request success — a queued set must be durable
          // before the UI treats it as saved.
          t.oncomplete = () => resolve(request.result);
          t.onabort = () => reject(t.error ?? request.error ?? new Error("idb-tx-aborted"));
        } else {
          request.onsuccess = () => resolve(request.result);
        }
        request.onerror = () => reject(request.error ?? new Error("idb-tx-failed"));
      }),
  );
}

export function newClientId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

/**
 * New onboarding is a fresh account state (including after resetting demo data).
 * Old pending ops must never recreate old workouts/water entries after onboarding.
 * IndexedDB is device-local and cannot be deleted from the server.
 */
export async function clearLocalOnboardingState(): Promise<void> {
  try {
    await tx<undefined>(STORE_OPS, "readwrite", (s) => s.clear() as IDBRequest<undefined>);
    await tx<undefined>(STORE_CACHE, "readwrite", (s) => s.clear() as IDBRequest<undefined>);
  } catch {
    // A browser without IndexedDB still allows online onboarding.
  }
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith("esifit:workout-rest:")) localStorage.removeItem(key);
    }
  } catch {
    // Storage may be unavailable in private browsing.
  }
  window.dispatchEvent(new CustomEvent("esifit:queue-changed"));
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
    return all
      .filter((o) => o.status !== "synced" && o.status !== "conflict")
      .sort((a, b) => a.createdAt - b.createdAt); // replay in the order the user did things
  } catch {
    return [];
  }
}

export async function queuedCount(): Promise<number> {
  const ops = await getQueuedOperations();
  return ops.length;
}

export async function markOpStatus(
  clientId: string,
  status: SyncStatus,
  opts: { countAttempt?: boolean } = {},
): Promise<void> {
  const countAttempt = opts.countAttempt ?? status === "failed";
  const op = await tx<QueuedOperation | undefined>(STORE_OPS, "readonly", (s) => s.get(clientId) as IDBRequest<QueuedOperation | undefined>);
  if (op) {
    await tx(STORE_OPS, "readwrite", (s) => s.put({ ...op, status, attempts: op.attempts + (countAttempt ? 1 : 0) }));
    window.dispatchEvent(new CustomEvent("esifit:queue-changed"));
  }
}

async function removeOp(clientId: string): Promise<void> {
  await tx(STORE_OPS, "readwrite", (s) => s.delete(clientId));
}

// ---------------- Sync engine ----------------

let inflight: Promise<{ synced: number; failed: number }> | null = null;

/**
 * Drain the queue. A call made while a drain is running waits for it and then
 * drains again, so "finish workout" can never race past sets still in flight.
 */
export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  if (typeof navigator === "undefined" || !navigator.onLine) return { synced: 0, failed: 0 };
  if (inflight) {
    await inflight.catch(() => undefined);
  }
  if (inflight) return inflight; // another caller started the follow-up pass first
  inflight = drainQueue().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function drainQueue(): Promise<{ synced: number; failed: number }> {
  window.dispatchEvent(new CustomEvent("esifit:sync-status", { detail: "syncing" }));
  let synced = 0;
  let failed = 0;
  try {
    const ops = await getQueuedOperations();
    // Replay each durable operation individually; workout endpoints accept a one-set batch.
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
          const json = (await res.json().catch(() => null)) as { ok?: boolean; synced?: number; conflicts?: number; failed?: number } | null;
          // Server reports per-op outcome in the batch response. Transient
          // failures must stay queued; conflicts are terminal.
          if (json && typeof json.failed === "number" && json.failed > 0) {
            await markOpStatus(op.clientId, "failed");
            failed++;
          } else if (json && typeof json.conflicts === "number" && json.conflicts > 0 && (json.synced ?? 0) === 0) {
            await markOpStatus(op.clientId, "conflict");
            failed++;
          } else if (json?.ok === true && (op.kind !== "workout_set" || json.synced === 1)) {
            synced++;
            await removeOp(op.clientId);
          } else {
            // A malformed 200 response is not proof that a real set was stored.
            await markOpStatus(op.clientId, "failed", { countAttempt: false });
            failed++;
          }
        } else if (res.status === 401) {
          // Session expired: nothing will succeed until the user signs in again, and
          // the sets are real training data — keep them queued, don't burn attempts.
          await markOpStatus(op.clientId, "local", { countAttempt: false });
          failed++;
          break;
        } else if (res.status >= 400 && res.status < 500 && ![408, 425, 429].includes(res.status)) {
          // Invalid payload, denied ownership or deleted target cannot fix themselves.
          await markOpStatus(op.clientId, "conflict");
          failed++;
        } else {
          // 5xx / 408 / 425 / 429: retry later without burning attempts.
          await markOpStatus(op.clientId, "failed", { countAttempt: false });
          failed++;
        }
      } catch {
        await markOpStatus(op.clientId, "failed", { countAttempt: false });
        failed++;
      }
    }
  } finally {
    const remaining = await queuedCount();
    window.dispatchEvent(new CustomEvent("esifit:sync-status", { detail: remaining > 0 ? "failed" : "synced" }));
    window.dispatchEvent(new CustomEvent("esifit:queue-changed"));
  }
  return { synced, failed };
}

/** Completion must wait for this workout, including terminal conflicts. A strict
 * store read deliberately throws if persistence is unavailable: an empty fallback
 * would otherwise falsely declare the session safe to finish. */
export async function syncWorkoutBeforeComplete(sessionId: string, finishSavedSetsOnly = false): Promise<void> {
  await syncQueue();
  const all = await tx<QueuedOperation[]>(STORE_OPS, "readonly", store => store.getAll() as IDBRequest<QueuedOperation[]>);
  const unsaved = all.filter(op => op.kind === "workout_set" && op.payload.sessionId === sessionId && op.status !== "synced");
  const pending = unsaved.some(op => op.status !== "conflict");
  if (pending || (unsaved.length && !finishSavedSetsOnly)) {
    throw { code: "conflict", status: 409, canFinishSavedSets: !pending, message: pending
      ? "ثبت بعضی ست‌های این جلسه هنوز کامل نشده است؛ جلسه حفظ شد. پس از اتصال دوباره تلاش کنید."
      : "بعضی ست‌ها قابل ثبت نبودند؛ جلسه باز ماند. می‌توانید فقط با ست‌های ثبت‌شده پایان دهید." };
  }
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
  // Mark synchronously, before IndexedDB promises that can hang on Android.
  // A future openDb() finishes any interrupted purge before returning data.
  try { localStorage.setItem(PURGE_PENDING_KEY, "1"); } catch { /* unavailable */ }
  // Clear personalized navigation caches first as the DB deletion may stall.
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "esifit:clear-private-cache" });
  } catch {
    // No service worker on this device.
  }
  // Clear both stores before deleting the database: another open tab can block
  // deleteDatabase, but must never preserve the previous user's private data.
  try {
    await tx<undefined>(STORE_OPS, "readwrite", (store) => store.clear() as IDBRequest<undefined>);
    await tx<undefined>(STORE_CACHE, "readwrite", (store) => store.clear() as IDBRequest<undefined>);
  } catch {
    // No IndexedDB in private browsing; continue with best-effort cleanup.
  }
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
