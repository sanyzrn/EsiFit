import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";

export type RateLimitResult = { ok: boolean; retryAfterSeconds?: number };

/** Shared fixed window, serialized across instances including first-use/reset.
 * Database failures fail closed through the caller. Keys hash IPs at rest. */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const bucketKey = createHash("sha256").update(key).digest("hex");
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('esifit-rate-limit'), hashtext(${bucketKey}))`;
    const now = new Date();
    const bucket = await tx.rateLimitBucket.findUnique({ where: { key: bucketKey } });
    if (!bucket || bucket.resetAt <= now) {
      // Bounded indexed cleanup; avoid an indefinitely growing IP counter table.
      await tx.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "key" IN
        (SELECT "key" FROM "RateLimitBucket" WHERE "resetAt" < ${now} ORDER BY "resetAt" LIMIT 100 FOR UPDATE SKIP LOCKED)`;
      await tx.rateLimitBucket.upsert({
        where: { key: bucketKey },
        create: { key: bucketKey, count: 1, resetAt: new Date(now.getTime() + windowMs) },
        update: { count: 1, resetAt: new Date(now.getTime() + windowMs) },
      });
      return { ok: true };
    }
    if (bucket.count >= limit) return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt.getTime() - now.getTime()) / 1000)) };
    await tx.rateLimitBucket.update({ where: { key: bucketKey }, data: { count: { increment: 1 } } });
    return { ok: true };
  });
}
