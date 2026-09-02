import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { appErrorResponse } from "@/lib/errors/respond";
import { todayISO, parseISODateOnly, isoDateOnly, addDaysISO } from "@/lib/dates/jalali";
import { oneRepMax } from "@/lib/domain/body-math";
import { buildProgressInsights, type StrengthSeries } from "@/lib/domain/plateau";
import { computeEsiScore } from "@/lib/domain/esi-score";
import { computeGoalProgress } from "@/lib/domain/goals";
import { currentValueForGoal } from "@/lib/goal-values";

/**
 * Analytics overview — signature visualizations data.
 * - muscleVolume: aggregated volume per muscle group (last 30d)
 * - strengthRadar: per-pattern best estimated 1RM (normalized)
 * - streak calendar: activity per day (last 91 days)
 * - weightTrend: measurements
 * - volumeSeries: weekly volume
 * - prs: current personal records
 * - insights: plateau/progress detection (flag PLATEAU_DETECTOR)
 * - esiScore: explainable composite (flag ESISCORE)
 * - goals: live goal progress (flag GOAL_ENGINE)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireUser();
    const tz = session.timezone;

    const today = todayISO(tz);
    const start30 = addDaysISO(today, -29);
    const start91 = addDaysISO(today, -90);

    const sessions = await db.workoutSession.findMany({
      where: { userId: session.id, status: "completed", startedAt: { gte: parseISODateOnly(start91) } },
      include: {
        exerciseLogs: {
          include: {
            exercise: { include: { muscles: { include: { muscleGroup: true } } } },
            sets: true,
          },
        },
      },
      orderBy: { startedAt: "asc" },
    });

    // ---- Muscle volume map (30d) ----
    const muscleVolume: Record<string, number> = {};
    for (const s of sessions) {
      if (s.startedAt < parseISODateOnly(start30)) continue;
      for (const log of s.exerciseLogs) {
        const vol = log.sets.reduce((a, st) => a + (st.weightKg != null && st.reps != null ? st.weightKg * st.reps : 0), 0);
        for (const m of log.exercise.muscles) {
          const slug = m.muscleGroup.slug;
          muscleVolume[slug] = (muscleVolume[slug] ?? 0) + vol * m.intensity;
        }
      }
    }
    const maxVol = Math.max(1, ...Object.values(muscleVolume));

    // ---- Strength radar per movement pattern (normalized 0..100) ----
    const patternBest: Record<string, number> = {};
    for (const s of sessions) {
      for (const log of s.exerciseLogs) {
        for (const st of log.sets) {
          if (st.weightKg != null && st.reps != null) {
            const orm = st.weightKg * (1 + st.reps / 30);
            const p = log.exercise.movementPattern;
            patternBest[p] = Math.max(patternBest[p] ?? 0, orm);
          }
        }
      }
    }
    const radarPatterns = ["horizontal_push", "vertical_push", "horizontal_pull", "vertical_pull", "squat", "hinge", "core"];
    const radarMax = Math.max(1, ...Object.values(patternBest));

    // ---- Activity calendar (91d) ----
    const activityByDay: Record<string, number> = {};
    for (const s of sessions) {
      const key = isoDateOnly(s.startedAt, tz);
      activityByDay[key] = (activityByDay[key] ?? 0) + Math.round(s.totalVolumeKg / 100) + 10;
    }
    const waters = await db.waterLog.findMany({
      where: { userId: session.id, loggedAt: { gte: parseISODateOnly(start91) } },
      select: { logDate: true, ml: true },
    });
    for (const w of waters) activityByDay[w.logDate] = (activityByDay[w.logDate] ?? 0) + 4;

    // ---- Weight trend ----
    const measurements = await db.bodyMeasurement.findMany({
      where: { userId: session.id, weightKg: { not: null } },
      orderBy: { measuredOn: "asc" },
      select: { measuredOn: true, weightKg: true, bodyFatPct: true },
    });

    // ---- Weekly volume (12 weeks) ----
    const weekly: Array<{ weekStart: string; volume: number }> = [];
    for (let w = 11; w >= 0; w--) {
      const weekStart = addDaysISO(today, -(w * 7 + 6));
      const weekEnd = addDaysISO(today, -(w * 7));
      const vol = sessions
        .filter((s) => s.startedAt >= parseISODateOnly(weekStart) && s.startedAt <= parseISODateOnly(weekEnd))
        .reduce((a, s) => a + s.totalVolumeKg, 0);
      weekly.push({ weekStart, volume: Math.round(vol) });
    }

    // ---- PRs ----
    const prs = await db.personalRecord.findMany({
      where: { userId: session.id, isCurrent: true },
      include: { exercise: { select: { nameFa: true, slug: true } } },
      orderBy: { value: "desc" },
      take: 12,
    });

    // ---- Strength series (for insights + EsiScore trend) ----
    // Best est. 1RM per exercise per session, chronological.
    const perExercise = new Map<string, { name: string; points: Array<{ date: string; best: number }> }>();
    for (const s of sessions) {
      const dateKey = isoDateOnly(s.startedAt, tz);
      for (const log of s.exerciseLogs) {
        const best = log.sets.reduce((max, st) => {
          if (st.weightKg == null || st.reps == null || st.isWarmup) return max;
          return Math.max(max, oneRepMax(st.weightKg, st.reps).recommended);
        }, 0);
        if (best <= 0) continue;
        const entry = perExercise.get(log.exercise.slug) ?? { name: log.exercise.nameFa, points: [] };
        const lastPoint = entry.points[entry.points.length - 1];
        if (lastPoint && lastPoint.date === dateKey) {
          lastPoint.best = Math.max(lastPoint.best, best);
        } else {
          entry.points.push({ date: dateKey, best: Math.round(best * 10) / 10 });
        }
        perExercise.set(log.exercise.slug, entry);
      }
    }
    const strengthSeries: StrengthSeries[] = [...perExercise.entries()]
      .filter(([, v]) => v.points.length >= 3)
      .sort((a, b) => b[1].points.length - a[1].points.length)
      .slice(0, 10)
      .map(([slug, v]) => ({ exerciseSlug: slug, exerciseName: v.name, dates: v.points.map((p) => p.date), bestKg: v.points.map((p) => p.best) }));

    // ---- Insights (plateau detector) ----
    const last30 = sessions.filter((s) => s.startedAt >= parseISODateOnly(start30));
    const lastSessionDate = sessions.length > 0 ? isoDateOnly(sessions[sessions.length - 1].startedAt, tz) : null;
    const daysSinceLast = lastSessionDate
      ? Math.round((Date.parse(today) - Date.parse(lastSessionDate)) / 86_400_000)
      : null;

    const profile = await db.userProfile.findUnique({ where: { userId: session.id }, select: { weeklyWorkoutTarget: true } });
    const weeklyTarget = profile?.weeklyWorkoutTarget ?? 3;

    // sessions per ISO week for the last 4 weeks
    const adherenceWeeks: string[] = [];
    const adherenceCounts: number[] = [];
    for (let w = 3; w >= 0; w--) {
      const weekStart = addDaysISO(today, -(w * 7 + 6));
      const weekEnd = addDaysISO(today, -(w * 7));
      adherenceWeeks.push(weekStart);
      adherenceCounts.push(
        sessions.filter((s) => s.startedAt >= parseISODateOnly(weekStart) && s.startedAt <= parseISODateOnly(weekEnd)).length,
      );
    }

    const prs30d = await db.personalRecord.count({
      where: { userId: session.id, achievedAt: { gte: parseISODateOnly(start30) } },
    });

    const insights = buildProgressInsights({
      series: strengthSeries,
      weeklyTonnage: weekly.slice(-4).map((w) => w.volume),
      adherence: { weekStarts: adherenceWeeks, sessions: adherenceCounts, plannedPerWeek: weeklyTarget },
      daysSinceLastSession: daysSinceLast,
      prsLast30Days: prs30d,
      weeklySessionsTarget: weeklyTarget,
    });

    // ---- EsiScore ----
    const sessions28 = sessions.filter((s) => s.startedAt >= parseISODateOnly(addDaysISO(today, -27))).length;
    const readinessAvg = await db.readinessDaily.aggregate({
      where: { userId: session.id, scoreDate: { gte: addDaysISO(today, -13) } },
      _avg: { score: true },
    });
    const nutritionDays28 = await db.nutritionDay.count({
      where: { userId: session.id, logDate: { gte: addDaysISO(today, -27) }, entries: { some: {} } },
    });
    // Streak via the shared engine.
    const { activityStreak } = await import("@/lib/domain/gamification-engine");
    const streak = await activityStreak(session.id);

    // Strength trend percent: compare first vs last best across top exercises (90d).
    let strengthTrendPct: number | null = null;
    const trendSamples: number[] = [];
    for (const s of strengthSeries) {
      if (s.bestKg.length >= 4) {
        const first = s.bestKg[0];
        const last = s.bestKg[s.bestKg.length - 1];
        if (first > 0) trendSamples.push(((last - first) / first) * 100);
      }
    }
    if (trendSamples.length > 0) strengthTrendPct = trendSamples.reduce((a, b) => a + b, 0) / trendSamples.length;

    const volumeTrendPct =
      weekly.length >= 3 && weekly.at(-3)!.volume > 0
        ? ((weekly.at(-1)!.volume - weekly.at(-3)!.volume) / weekly.at(-3)!.volume) * 100
        : null;

    const esiScore = computeEsiScore({
      sessionsLast28d: sessions28,
      weeklyTarget,
      streakDays: streak,
      prsLast30d: prs30d,
      strengthTrendPct,
      volumeTrendPct,
      avgReadiness14d: readinessAvg._avg.score ?? null,
      nutritionDaysLogged28d: nutritionDays28,
    });

    // ---- Goals ----
    const goalRows = await db.goal.findMany({ where: { userId: session.id }, orderBy: { createdAt: "desc" } });
    const goals = await Promise.all(
      goalRows.map(async (g) => {
        const current = await currentValueForGoal(session.id, g, today);
        const progress = computeGoalProgress(g, current, today);
        if (progress.achieved && g.status === "active") {
          await db.goal.update({ where: { id: g.id }, data: { status: "achieved" } });
        }
        return {
          id: g.id,
          type: g.type,
          title: g.title,
          unit: g.unit,
          startDate: g.startDate,
          targetDate: g.targetDate,
          status: progress.achieved && g.status === "active" ? "achieved" : g.status,
          startValue: g.startValue,
          targetValue: g.targetValue,
          currentValue: current,
          percent: progress.percent,
          direction: progress.direction,
          etaDays: progress.etaDays,
          statusFa: progress.statusFa,
        };
      }),
    );

    return NextResponse.json({
      ok: true,
      muscleVolume: Object.fromEntries(
        Object.entries(muscleVolume).map(([k, v]) => [k, Math.round((v / maxVol) * 100)]),
      ),
      radar: radarPatterns.map((p) => ({
        pattern: p,
        value: Math.round((patternBest[p] ?? 0) / radarMax * 100),
      })),
      activity: activityByDay,
      weightTrend: measurements.map((m) => ({
        date: m.measuredOn,
        weight: m.weightKg,
        bodyFat: m.bodyFatPct,
      })),
      weeklyVolume: weekly,
      prs: prs.map((p) => ({
        id: p.id,
        exerciseName: p.exercise.nameFa,
        value: p.value,
        unit: p.unit,
        achievedAt: p.achievedAt,
      })),
      totals: { sessions: sessions.length, volumeKg: Math.round(sessions.reduce((a, s) => a + s.totalVolumeKg, 0)) },
      insights,
      esiScore,
      goals,
      strengthTrend: strengthSeries.slice(0, 6).map((s) => ({
        exerciseSlug: s.exerciseSlug,
        exerciseName: s.exerciseName,
        points: s.bestKg.map((best, i) => ({ date: s.dates[i], best })),
      })),
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
