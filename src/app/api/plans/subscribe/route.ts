import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { z } from "zod";
import { appErrorResponse } from "@/lib/errors/respond";

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
    if (!mockPaymentAllowed()) {
      return NextResponse.json(
        { ok: false, code: "provider", message: "پرداخت واقعی هنوز متصل نشده است. لطفاً بعداً تلاش کنید." },
        { status: 502 },
      );
    }
    const body = schema.parse(await req.json());
    const plan = await db.subscriptionPlan.findUnique({ where: { code: body.planCode } });
    if (!plan || !plan.active) {
      return NextResponse.json({ ok: false, code: "not_found", message: "پلن یافت نشد." }, { status: 404 });
    }

    const periodEnd = new Date();
    if (plan.billingPeriod === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);

    await db.$transaction([
      db.subscription.updateMany({
        where: { userId: session.id, status: "active" },
        data: { status: "canceled", canceledAt: new Date() },
      }),
      db.subscription.create({
        data: {
          userId: session.id,
          planCode: plan.code,
          tier: plan.tier,
          status: "active",
          currentPeriodEndsAt: periodEnd,
        },
      }),
      db.user.update({ where: { id: session.id }, data: { tier: plan.tier } }),
      db.notification.create({
        data: {
          userId: session.id,
          type: "system",
          title: `اشتراک ${plan.nameFa} فعال شد`,
          body: "پرداخت آزمایشی با موفقیت انجام شد. مزایای پلن از همین لحظه فعال است.",
          actionUrl: "/plans",
        },
      }),
    ]);

    return NextResponse.json({ ok: true, tier: plan.tier, message: `اشتراک ${plan.nameFa} فعال شد.` });
  } catch (error) {
    return appErrorResponse(error);
  }
}

export async function GET() {
  try {
    const session = await getSessionUser();
    const plans = await db.subscriptionPlan.findMany({ where: { active: true }, orderBy: { priceToman: "asc" } });
    return NextResponse.json({
      ok: true,
      plans: plans.map((p) => ({ ...p, featuresFa: JSON.parse(p.featuresFa) as string[] })),
      currentTier: session?.tier ?? null,
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
