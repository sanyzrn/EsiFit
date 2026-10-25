import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { db } from "@/lib/db";
import { orderReceipt } from "@/lib/commerce/orders";

/** Member fitness/account/commerce export, available independently of paid tier.
 * Session tokens, credentials and other people's records are never exported. */
export async function GET() {
  try {
    const session = await getSessionUser();
    if (session && session.role !== "member") return NextResponse.json({ ok: false, code: "authorization", message: "این بخش مخصوص ورزشکاران است." }, { status: 403 });
    if (!session) {
      return NextResponse.json({ ok: false, code: "authentication" }, { status: 401 });
    }
    const [
      profile, measurements, goals, sessions, prs, nutritionDays, waterLogs,
      sleepLogs, readiness, calculatorResults, badges, xpLogs, swaps, painReports, orders, subscriptions, accountSettings, planningRuns,
    ] = await Promise.all([
      db.userProfile.findUnique({ where: { userId: session.id } }),
      db.bodyMeasurement.findMany({ where: { userId: session.id }, orderBy: { measuredOn: "asc" } }),
      db.goal.findMany({ where: { userId: session.id } }),
      db.workoutSession.findMany({
        where: { userId: session.id },
        include: { exerciseLogs: { include: { exercise: { select: { nameFa: true, slug: true } }, sets: true } } },
        orderBy: { startedAt: "asc" },
      }),
      db.personalRecord.findMany({ where: { userId: session.id }, include: { exercise: { select: { nameFa: true, slug: true } } } }),
      db.nutritionDay.findMany({ where: { userId: session.id }, include: { entries: { include: { food: { select: { nameFa: true, slug: true } } } } } }),
      db.waterLog.findMany({ where: { userId: session.id } }),
      db.sleepLog.findMany({ where: { userId: session.id } }),
      db.readinessDaily.findMany({ where: { userId: session.id } }),
      db.calculatorResult.findMany({ where: { userId: session.id } }),
      db.userBadge.findMany({ where: { userId: session.id }, include: { badge: { select: { nameFa: true } } } }),
      db.xpLog.findMany({ where: { userId: session.id } }),
      db.exerciseSwap.findMany({ where: { userId: session.id } }),
      db.painReport.findMany({ where: { userId: session.id } }),
      db.order.findMany({ where: { userId: session.id }, orderBy: { createdAt: "asc" } }),
      db.subscription.findMany({ where: { userId: session.id }, orderBy: { startsAt: "asc" } }),
      db.user.findUnique({ where: { id: session.id }, select: { locale: true, theme: true, reducedMotion: true, createdAt: true } }),
      db.aiPlanRun.findMany({where:{athleteId:session.id},orderBy:{createdAt:"asc"},select:{id:true,status:true,source:true,requestNote:true,planJson:true,explanationJson:true,riskJson:true,appliedPlanId:true,reviewRequestedAt:true,createdAt:true,updatedAt:true}}),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      format: "esifit-export-v1",
      account: {
        phone: session.phone,
        displayName: session.displayName,
        role: session.role,
        tier: session.tier,
        timezone: session.timezone,
        unitSystem: session.unitSystem,
        ...accountSettings,
      },
      profile,
      measurements,
      goals,
      workouts: sessions,
      personalRecords: prs,
      nutritionDays,
      waterLogs,
      sleepLogs,
      readinessDays: readiness,
      calculatorResults,
      badges,
      xpLedger: xpLogs,
      exerciseSwaps: swaps,
      painReports,
      orders: orders.map(orderReceipt),
      subscriptions,
      planningRuns,
    };

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(payload, null, 1), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="esifit-export-${stamp}.json"`,
      },
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
