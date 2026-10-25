import { rateLimit } from "@/lib/http/rate-limit";
import { requireMember } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { z } from "zod";
import { appErrorResponse } from "@/lib/errors/respond";
import { isMemberTier, MEMBER_TIERS } from "@/lib/auth/access-policy";

/**
 * Subscription change (mock payment sandbox).
 * Server-side tier assignment: this is the authoritative entitlement source.
 * Production requires an explicit opt-in flag — otherwise unpaid tier upgrades
 * would be a full entitlement bypass.
 */
const schema = z.object({ planCode: z.string() });

function mockPaymentAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_MOCK_PAYMENT === "true";
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ ok: false, code: "authentication", message: "برای ارتقا حساب وارد شوید." }, { status: 401 });
    }
    if (session.role !== "member") {
      return NextResponse.json({ ok: false, code: "authorization", message: "اشتراک‌های VIP فقط برای ورزشکاران هستند." }, { status: 403 });
    }
    if (!mockPaymentAllowed()) {
      return NextResponse.json(
        { ok: false, code: "provider", message: "پرداخت واقعی هنوز متصل نشده است. لطفاً بعداً تلاش کنید." },
        { status: 502 },
      );
    }
    const body = schema.parse(await req.json());
    const limit = await rateLimit(`plans:subscribe:${session.id}`, 10, 60 * 60 * 1000);
    if (!limit.ok) return NextResponse.json({ ok: false, code: "rate_limit", message: "تعداد تغییرات اشتراک زیاد است؛ کمی بعد تلاش کنید.", retryAfterSeconds: limit.retryAfterSeconds }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    const plan = await db.subscriptionPlan.findUnique({ where: { code: body.planCode } });
    if (!plan || !plan.active || plan.currency !== "IRT" || !isMemberTier(plan.tier)) {
      return NextResponse.json({ ok: false, code: "not_found", message: "پلن یافت نشد." }, { status: 404 });
    }

    const periodEnd = new Date();
    if (plan.billingPeriod === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);

    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${session.id} FOR UPDATE`;
      await tx.subscription.updateMany({ where: { userId: session.id, status: "active" }, data: { status: "canceled", canceledAt: new Date() } });
      await tx.subscription.create({ data: { userId: session.id, planCode: plan.code, tier: plan.tier, status: "active", currentPeriodEndsAt: periodEnd } });
      await tx.user.update({ where: { id: session.id }, data: { tier: plan.tier } });
      await tx.notification.create({ data: { userId: session.id, type: "system", title: `اشتراک ${plan.nameFa} فعال شد`, body: "پرداخت آزمایشی با موفقیت انجام شد. این اشتراک تمدید خودکار ندارد.", actionUrl: "/plans" } });
    });

    return NextResponse.json({ ok: true, tier: plan.tier, message: `اشتراک ${plan.nameFa} فعال شد.` });
  } catch (error) {
    return appErrorResponse(error);
  }
}

export async function GET() {
  try {
    const session = await getSessionUser();
    const plans = await db.subscriptionPlan.findMany({ where: { active: true, currency: "IRT", tier: { in: [...MEMBER_TIERS] } }, orderBy: { priceToman: "asc" } });
    const currentSubscription = session?.role === "member" ? await db.subscription.findFirst({
      where: { userId: session.id, status: "active", currentPeriodEndsAt: { gte: new Date() } },
      orderBy: { startsAt: "desc" }, select: { id: true, planCode: true, tier: true, startsAt: true, currentPeriodEndsAt: true },
    }) : null;
    return NextResponse.json({
      ok: true,
      plans: plans.map((p) => ({ ...p, featuresFa: JSON.parse(p.featuresFa) as string[] })),
      currentTier: session?.role === "member" ? session.tier : null,
      currentSubscription,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return appErrorResponse(error);
  }
}

/** Immediate self-service cancellation for the current sandbox subscription.
 * No gateway refund or recurring-billing action is implied by a local cancel. */
export async function DELETE() {
  try {
    const member = await requireMember();
    const result = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${member.id} FOR UPDATE`;
      const active = await tx.subscription.findFirst({ where: { userId: member.id, status: "active", currentPeriodEndsAt: { gte: new Date() } }, select: { id: true } });
      if (!active) {
        const user = await tx.user.findUniqueOrThrow({ where: { id: member.id }, select: { tier: true } });
        return { canceled: false, tier: user.tier, message: "اشتراک خریداری‌شدهٔ فعالی برای لغو وجود ندارد." };
      }
      await tx.subscription.updateMany({ where: { userId: member.id, status: "active" }, data: { status: "canceled", canceledAt: new Date() } });
      await tx.user.update({ where: { id: member.id }, data: { tier: "free" } });
      await tx.notification.create({ data: { userId: member.id, type: "system", title: "اشتراک شما لغو شد", body: "مزایای ویژه پایان یافت و حساب شما به پلن رایگان برگشت. داده‌ها و سفارش‌های شما حفظ شده‌اند.", actionUrl: "/plans" } });
      return { canceled: true, tier: "free", message: "اشتراک لغو شد و پلن رایگان فعال است." };
    });
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return appErrorResponse(error); }
}
