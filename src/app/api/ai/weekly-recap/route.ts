import { NextResponse } from "next/server";
import { appErrorResponse } from "@/lib/errors/respond";
import ZAI from "z-ai-web-dev-sdk";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { getEntitlements, type UserTier } from "@/lib/entitlements/entitlements";
import { buildWeeklyRecap, type RecapMetrics } from "@/lib/domain/weekly-recap";
import { activityStreak } from "@/lib/domain/gamification-engine";
import { todayISO, addDaysISO, parseISODateOnly, isoDateOnly } from "@/lib/dates/jalali";
import { resolveFeatureFlag } from "@/lib/feature-flags/registry";

/**
 * Weekly AI recap (flag WEEKLY_RECAP, entitlement weeklyRecap).
 * Metrics are always computed deterministically from user data; the AI layer
 * only rewrites the narrative (never invents numbers). Rules text is the
 * persistent fallback if the provider fails.
 */

function currentWeekStart(today: string): string {
  // Jalali weeks start Saturday. Walk back to the nearest Saturday (≤ today).
  const d = parseISODateOnly(today);
  const dow = d.getUTCDay(); // 6 = Saturday
  const back = (dow + 1) % 7; // days since Saturday
  return addDaysISO(today, -back);
}

/** Recap always covers the last *completed* week (Saturday→Friday), never the in-progress one. */
function lastCompletedWeekStart(today: string): string {
  return addDaysISO(currentWeekStart(today), -7);
}

async function buildMetrics(userId: string, today: string, weekStart: string): Promise<RecapMetrics> {
  const profile = await db.userProfile.findUnique({ where: { userId }, select: { weeklyWorkoutTarget: true } });
  const weekStartTime = parseISODateOnly(weekStart);
  const prevWeekStart = addDaysISO(weekStart, -7);
  const since30 = parseISODateOnly(addDaysISO(today, -29));

  const [weekSessions, prevSessions, weekPrs, readiness, nutritionDays, streak, measurements] = await Promise.all([
    db.workoutSession.findMany({
      where: { userId, status: "completed", startedAt: { gte: weekStartTime } },
      include: { exerciseLogs: { include: { exercise: { select: { nameFa: true } }, sets: true } } },
    }),
    db.workoutSession.findMany({
      where: { userId, status: "completed", startedAt: { gte: parseISODateOnly(prevWeekStart), lt: weekStartTime } },
      select: { totalVolumeKg: true },
    }),
    db.personalRecord.findMany({
      where: { userId, achievedAt: { gte: weekStartTime } },
      include: { exercise: { select: { nameFa: true } } },
    }),
    db.readinessDaily.aggregate({
      where: { userId, scoreDate: { gte: weekStart } },
      _avg: { score: true },
    }),
    db.nutritionDay.count({ where: { userId, logDate: { gte: weekStart }, entries: { some: {} } } }),
    activityStreak(userId),
    db.bodyMeasurement.findMany({
      where: { userId, weightKg: { not: null }, measuredOn: { gte: addDaysISO(today, -30) } },
      orderBy: { measuredOn: "asc" },
      select: { measuredOn: true, weightKg: true },
    }),
  ]);

  const tonnage = weekSessions.reduce((a, s) => a + s.totalVolumeKg, 0);
  const prevTonnage = prevSessions.reduce((a, s) => a + s.totalVolumeKg, 0);

  // Top exercise by volume this week.
  const exVol = new Map<string, number>();
  for (const s of weekSessions) {
    for (const log of s.exerciseLogs) {
      const v = log.sets.reduce((a, st) => a + (st.weightKg != null && st.reps != null ? st.weightKg * st.reps : 0), 0);
      exVol.set(log.exercise.nameFa, (exVol.get(log.exercise.nameFa) ?? 0) + v);
    }
  }
  const topExercise = [...exVol.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Weight delta within the week (first vs last measurement of this week).
  const weekWeights = measurements.filter((m) => m.measuredOn >= weekStart);
  const weightDelta =
    weekWeights.length >= 2 ? weekWeights.at(-1)!.weightKg! - weekWeights[0].weightKg! : null;

  // Session count windows longer than the week for context — unused for now,
  // kept intentionally local (no silent scope creep).
  void since30;

  return {
    weekStart,
    sessions: weekSessions.length,
    plannedSessions: profile?.weeklyWorkoutTarget ?? 3,
    tonnageKg: Math.round(tonnage),
    prevTonnageKg: Math.round(prevTonnage) || null,
    prs: weekPrs.map((p) => ({ exerciseName: p.exercise.nameFa, valueKg: p.value })),
    avgReadiness: readiness._avg.score != null ? Math.round(readiness._avg.score) : null,
    nutritionDaysLogged: nutritionDays,
    streakDays: streak,
    weightDeltaKg: weightDelta != null ? Math.round(weightDelta * 10) / 10 : null,
    topExerciseName: topExercise,
  };
}

/** GET — recap for the last completed week (builds + persists on first call). */
export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ ok: false, code: "authentication" }, { status: 401 });
    }

    const ent = getEntitlements(session.tier as UserTier);
    if (!ent.weeklyRecap) {
      throw new AppError("authorization", {
        userMessage: "جمع‌بندی هوشمند هفته در پلن وی‌آی‌پی فعال می‌شود؛ تحلیل‌های اصلی برای همه آزاد است.",
      });
    }

    const today = todayISO(session.timezone);
    // Never freeze a partial in-progress week — recap is always last completed week.
    const weekStart = lastCompletedWeekStart(today);

    const stored = await db.weeklyRecap.findUnique({
      where: { userId_weekStart: { userId: session.id, weekStart } },
    });

    if (stored) {
      return NextResponse.json({
        ok: true,
        recap: {
          weekStart: stored.weekStart,
          contentFa: stored.contentFa,
          source: stored.source,
          metrics: JSON.parse(stored.metricsJson) as RecapMetrics,
        },
      });
    }

    // Build fresh (rules) and persist.
    const metrics = await buildMetrics(session.id, today, weekStart);
    const recap = buildWeeklyRecap(metrics);
    await db.weeklyRecap.upsert({
      where: { userId_weekStart: { userId: session.id, weekStart } },
      update: { contentFa: recap.contentFa, metricsJson: JSON.stringify(metrics), source: "rules" },
      create: {
        userId: session.id,
        weekStart,
        contentFa: recap.contentFa,
        metricsJson: JSON.stringify(metrics),
        source: "rules",
      },
    });

    return NextResponse.json({ ok: true, recap: { weekStart, contentFa: recap.contentFa, source: "rules", metrics } });
  } catch (error) {
    return appErrorResponse(error);
  }
}

/** POST — AI-enhanced rewrite of this week's recap (deepContext tiers only). */
export async function POST() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ ok: false, code: "authentication" }, { status: 401 });
    }

    const ent = getEntitlements(session.tier as UserTier);
    if (!ent.weeklyRecap) {
      throw new AppError("authorization", { userMessage: "این قابلیت در پلن شما فعال نیست." });
    }
    if (!ent.aiDeepContext || !resolveFeatureFlag("AI_CHAT")) {
      throw new AppError("authorization", { userMessage: "بازنویسی هوشمند برای پلن وی‌آی‌پی پلاس است." });
    }

    const today = todayISO(session.timezone);
    const weekStart = lastCompletedWeekStart(today);

    const stored = await db.weeklyRecap.findUnique({
      where: { userId_weekStart: { userId: session.id, weekStart } },
    });
    const metrics: RecapMetrics = stored
      ? (JSON.parse(stored.metricsJson) as RecapMetrics)
      : await buildMetrics(session.id, today, weekStart);
    const rulesRecap = buildWeeklyRecap(metrics);

    // AI rewrite — rules text is the fallback on any failure.
    let contentFa = rulesRecap.contentFa;
    let source: "rules" | "ai" = "rules";
    try {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "تو گزارش‌نویس اسی‌فیت هستی. با داده‌های دقیقی که می‌گیری یک جمع‌بندی انگیزشی ۳ تا ۵ جمله‌ای فارسی بنویس. فقط از همین اعداد استفاده کن، عدد جدید نیاور. لحن صمیمی و مربی‌گونه، بدون وعده پزشکی.",
          },
          {
            role: "user",
            content: `داده‌های هفته:\n${JSON.stringify(metrics, null, 1)}\n\nنسخه پایه:\n${rulesRecap.contentFa}`,
          },
        ],
        temperature: 0.4,
      });
      const text = completion.choices[0]?.message?.content?.trim();
      if (text && text.length > 40) {
        contentFa = text;
        source = "ai";
      }
    } catch {
      // Provider unavailable — rules text already in place.
    }

    await db.weeklyRecap.upsert({
      where: { userId_weekStart: { userId: session.id, weekStart } },
      update: { contentFa, metricsJson: JSON.stringify(metrics), source },
      create: { userId: session.id, weekStart, contentFa, metricsJson: JSON.stringify(metrics), source },
    });

    return NextResponse.json({ ok: true, recap: { weekStart, contentFa, source, metrics } });
  } catch (error) {
    return appErrorResponse(error);
  }
}
