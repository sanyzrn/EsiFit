import "server-only";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import type { SessionUser } from "@/lib/auth/session";
import { resolveFeatureFlag } from "@/lib/feature-flags/registry";

export async function getAiAccess(actor: SessionUser, providerId?: string) {
  if (!resolveFeatureFlag("AI_CHAT"))
    throw new AppError("authorization", {
      userMessage: "دستیار موقتاً غیرفعال است.",
    });
  if (actor.role === "admin") {
    const provider = await db.aiProvider.findFirst({
      where: { enabled: true, ...(providerId ? { id: providerId } : {}) },
      orderBy: { createdAt: "asc" },
    });
    if (!provider)
      throw new AppError("conflict", {
        userMessage:
          "ابتدا در مدیریت ← هوش مصنوعی یک اتصال را اضافه و آزمایش کنید.",
      });
    return { provider, dailyLimit: 200, monthlyLimit: 5000 };
  }
  const grant = await db.aiGrant.findUnique({
    where: { userId: actor.id },
    include: { provider: true },
  });
  if (
    !grant?.enabled ||
    !grant.provider.enabled ||
    !grant.dailyLimit ||
    !grant.monthlyLimit
  ) {
    throw new AppError("authorization", {
      userMessage:
        "دسترسی همپا هنوز برای شما فعال نشده است. از مدیر بخواهید دسترسی و سهمیه تعیین کند.",
    });
  }
  if (providerId && providerId !== grant.providerId)
    throw new AppError("authorization");
  return {
    provider: grant.provider,
    dailyLimit: grant.dailyLimit,
    monthlyLimit: grant.monthlyLimit,
  };
}
