/**
 * In-process sliding-window rate limiter.
 * Suitable for a single Node deployment. Multi-instance production should
 * replace this with Redis (or platform) counters behind the same interface.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  retryAfterSeconds?: number;
};

const MAX_BUCKETS = 5_000;

/** Drop expired windows so a long-lived process never grows the map without bound. */
function prune(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (buckets.size >= MAX_BUCKETS) prune(now);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  return { ok: true };
}

/** Test helper — clear all buckets. */
export function resetRateLimits(): void {
  buckets.clear();
}
