import "server-only";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { todayISO } from "@/lib/dates/jalali";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

const PENDING_TTL_MS = 5 * 60 * 1000;
export type QuotaClaim =
  | { ok: true; requestId: string; dayKey: string; used: number; limit: number }
  | { ok: false; used: number; limit: number };
export const newQuotaRequestId = () => `aiq-${randomUUID()}`;
function usageWhere(
  userId: string,
  timezone: string,
  monthly = false,
): Prisma.AiUsageLogWhereInput {
  const today = todayISO(timezone);
  const start = monthly ? `${today.slice(0, 7)}-01` : today;
  return {
    userId,
    OR: [
      { dayKey: { gte: start, lte: today }, status: "success" },
      {
        dayKey: { gte: start, lte: today },
        status: "pending",
        createdAt: { gt: new Date(Date.now() - PENDING_TTL_MS) },
      },
      {
        dayKey: "",
        status: "success",
        createdAt: { gte: new Date(`${start}T00:00:00Z`) },
      },
    ],
  };
}

/** Serialize reservations per user. INSERT…SELECT alone does not serialize concurrent snapshots. */
export async function claimAiQuotaSlot(params: {
  userId: string;
  timezone: string;
  limit: number;
  monthlyLimit?: number;
  requestId?: string;
  conversationId?: string | null;
  provider?: string;
  model?: string;
}): Promise<QuotaClaim> {
  const requestId = params.requestId ?? newQuotaRequestId();
  const dayKey = todayISO(params.timezone);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`ai-quota:${params.userId}`}, 0))`;
    const used = await tx.aiUsageLog.count({
      where: usageWhere(params.userId, params.timezone),
    });
    const existing = await tx.aiUsageLog.findUnique({ where: { requestId } });
    if (existing) {
      return existing.userId === params.userId && existing.status === "pending"
        ? { ok: true, requestId, dayKey, used, limit: params.limit }
        : { ok: false, used, limit: params.limit };
    }
    const monthUsed =
      params.monthlyLimit == null
        ? 0
        : await tx.aiUsageLog.count({
            where: usageWhere(params.userId, params.timezone, true),
          });
    if (
      used >= params.limit ||
      (params.monthlyLimit != null && monthUsed >= params.monthlyLimit)
    )
      return { ok: false, used, limit: params.limit };
    await tx.aiUsageLog.create({
      data: {
        id: requestId,
        requestId,
        userId: params.userId,
        dayKey,
        status: "pending",
        conversationId: params.conversationId,
        provider: params.provider ?? "unconfigured",
        model: params.model ?? "unconfigured",
      },
    });
    return { ok: true, requestId, dayKey, used: used + 1, limit: params.limit };
  });
}
export async function finalizeAiQuota(
  requestId: string,
  data: {
    conversationId?: string | null;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    latencyMs?: number;
  },
) {
  await db.aiUsageLog.updateMany({
    where: { requestId, status: "pending" },
    data: { status: "success", ...data },
  });
}
export async function releaseAiQuotaSlot(
  requestId: string,
  status: "failed" | "blocked" = "failed",
) {
  await db.aiUsageLog.updateMany({
    where: { requestId, status: "pending" },
    data: { status },
  });
}
export async function countAiQuotaUsage(
  userId: string,
  timezone: string,
  monthly = false,
) {
  return db.aiUsageLog.count({ where: usageWhere(userId, timezone, monthly) });
}
export function assertQuotaClaim(
  claim: QuotaClaim,
): asserts claim is Extract<QuotaClaim, { ok: true }> {
  if (!claim.ok)
    throw new AppError("quota", {
      userMessage:
        "سهمیه روزانه یا ماهانهٔ همپا تمام شده است. برای تغییر سهمیه با مدیر تماس بگیرید.",
    });
}
