import "server-only";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { todayISO } from "@/lib/dates/jalali";
import { randomUUID } from "crypto";

/**
 * Atomic AI daily-quota reservation (concurrency-safe without Redis).
 *
 * A slot is claimed by inserting a `pending` AiUsageLog row only when the
 * current success+pending count for the user-local day is still under the
 * limit — done in a single INSERT…SELECT so parallel requests cannot both
 * observe "under limit" and both insert.
 *
 * Pending rows older than PENDING_TTL_MS are ignored (crash recovery).
 * Provider failure must call releaseAiQuotaSlot so the slot frees immediately.
 */

const PENDING_TTL_MS = 5 * 60 * 1000;

export type QuotaClaim =
  | { ok: true; requestId: string; dayKey: string; used: number; limit: number }
  | { ok: false; used: number; limit: number };

export function newQuotaRequestId(): string {
  return `aiq-${randomUUID()}`;
}

export async function claimAiQuotaSlot(params: {
  userId: string;
  timezone: string;
  limit: number;
  requestId?: string;
  conversationId?: string | null;
}): Promise<QuotaClaim> {
  const { userId, timezone, limit } = params;
  const requestId = params.requestId ?? newQuotaRequestId();
  const dayKey = todayISO(timezone);
  const pendingBefore = new Date(Date.now() - PENDING_TTL_MS);

  // Single-statement conditional insert: count includes this day's successes
  // and live pending reservations; stale pendings are free.
  const inserted = await db.$executeRaw`
    INSERT INTO "AiUsageLog" (
      "id", "userId", "conversationId", "provider", "model",
      "status", "dayKey", "requestId", "createdAt"
    )
    SELECT
      ${requestId},
      ${userId},
      ${params.conversationId ?? null},
      'z-ai',
      'glm-4-flash',
      'pending',
      ${dayKey},
      ${requestId},
      NOW()
    WHERE (
      SELECT COUNT(*)::int
      FROM "AiUsageLog" u
      WHERE u."userId" = ${userId}
        AND (
          (u."dayKey" = ${dayKey} AND u."status" = 'success')
          OR (u."dayKey" = ${dayKey} AND u."status" = 'pending' AND u."createdAt" > ${pendingBefore})
          OR (u."dayKey" = '' AND u."status" = 'success' AND u."createdAt" >= ${new Date(`${dayKey}T00:00:00.000Z`)})
        )
    ) < ${limit}
  `;

  if (inserted >= 1) {
    const used = await countAiQuotaUsage(userId, timezone);
    return { ok: true, requestId, dayKey, used, limit };
  }

  // Unique requestId collision (rare retry of same id) still counts as claimed
  // only if our pending row exists.
  const existing = await db.aiUsageLog.findUnique({ where: { requestId } });
  if (existing && existing.userId === userId && existing.status === "pending") {
    const used = await countAiQuotaUsage(userId, timezone);
    return { ok: true, requestId, dayKey, used, limit };
  }

  const used = await countAiQuotaUsage(userId, timezone);
  return { ok: false, used, limit };
}

/** Mark reservation as a successful billable completion. */
export async function finalizeAiQuota(
  requestId: string,
  data: {
    conversationId?: string | null;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    latencyMs?: number;
  },
): Promise<void> {
  await db.aiUsageLog.updateMany({
    where: { requestId, status: "pending" },
    data: {
      status: "success",
      conversationId: data.conversationId ?? undefined,
      promptTokens: data.promptTokens ?? 0,
      completionTokens: data.completionTokens ?? 0,
      totalTokens: data.totalTokens ?? 0,
      latencyMs: data.latencyMs ?? 0,
    },
  });
}

/** Free the reserved slot after a provider/block failure. */
export async function releaseAiQuotaSlot(
  requestId: string,
  status: "failed" | "blocked" = "failed",
): Promise<void> {
  await db.aiUsageLog.updateMany({
    where: { requestId, status: "pending" },
    data: { status },
  });
}

/** Current billable usage for the user-local day (success + live pending). */
export async function countAiQuotaUsage(userId: string, timezone: string): Promise<number> {
  const dayKey = todayISO(timezone);
  const pendingBefore = new Date(Date.now() - PENDING_TTL_MS);
  const rows = await db.aiUsageLog.findMany({
    where: {
      userId,
      OR: [
        { dayKey, status: "success" },
        { dayKey, status: "pending", createdAt: { gt: pendingBefore } },
        { dayKey: "", status: "success", createdAt: { gte: new Date(`${dayKey}T00:00:00.000Z`) } },
      ],
    },
    select: { id: true },
  });
  return rows.length;
}

/** Throw AppError(quota) when the claim failed. */
export function assertQuotaClaim(claim: QuotaClaim): asserts claim is Extract<QuotaClaim, { ok: true }> {
  if (!claim.ok) {
    throw new AppError("quota", {
      userMessage: `سهمیه روزانه (${claim.limit} پیام) تمام شده است. با ارتقای پلن سهمیه بیشتری بگیرید.`,
    });
  }
}
