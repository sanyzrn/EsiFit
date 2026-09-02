import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { db } from "@/lib/db";
import { getEntitlements, type UserTier } from "@/lib/entitlements/entitlements";

/**
 * GET /api/settings/export — full personal-data export (GDPR-style portability).
 * Entitlement `dataExport` is enforced server-side; free users get a clear
 * Persian pointer (never a dark pattern).
 */
export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ ok: false, code: "authentication" }, { status: 401 });
    }
    const ent = getEntitlements(session.tier as UserTier);
    if (!ent.dataExport) {
      return NextResponse.json(
        {
          ok: false,
          code: "authorization",
          message: "خروجی کامل داده‌ها از پلن وی‌آی‌پی فعال می‌شود؛ حساب و جلسات فعال همیشه از همین صفحه در دسترس است.",
        },
        { status: 403 },
      );
    }

    const [
      profile, measurements, goals, sessions, prs, nutritionDays, waterLogs,
      sleepLogs, readiness, calculatorResults, badges, xpLogs, swaps, painReports,
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
    };

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(payload, null, 1), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="esifit-export-${stamp}.json"`,
      },
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
