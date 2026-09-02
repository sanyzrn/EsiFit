import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { appErrorResponse } from "@/lib/errors/respond";
import { computeReadiness } from "@/lib/domain/body-math";
import { activityStreak, getXpTotal } from "@/lib/domain/gamification-engine";
import { levelFromXp } from "@/lib/domain/body-math";
import { getTodayPlanDay } from "@/features/workouts/data/plan-templates";
import { todayISO } from "@/lib/dates/jalali";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { adaptiveCoach, type ReadinessState } from "@/lib/domain/adaptive-coach";
import { computeGoalProgress } from "@/lib/domain/goals";
import { currentValueForGoal } from "@/lib/goal-values";

export async function GET() {
  try {
    const session = await requireUser();
    const today = todayISO(session.timezone as string);
    const tz = session.timezone as string;

    const [profile, readinessRow, todaySession, planDay, waterToday, mealsToday, xp, streak, latestWeight, firstWeight, flags] = await Promise.all([
      db.userProfile.findUnique({ where: { userId: session.id } }),
      db.readinessDaily.findUnique({ where: { userId_scoreDate: { userId: session.id, scoreDate: today } } }),
      db.workoutSession.findFirst({
        where: { userId: session.id, startedAt: { gte: new Date(`${today}T00:00:00.000Z`) }, status: { in: ["active", "paused"] } },
        orderBy: { startedAt: "desc" },
      }),
      getTodayPlanDay(session.id),
      db.waterLog.aggregate({
        where: { userId: session.id, logDate: today },
        _sum: { ml: true },
      }),
      db.nutritionDay.findUnique({
        where: { userId_logDate: { userId: session.id, logDate: today } },
        include: { entries: { include: { food: true } } },
      }),
      getXpTotal(session.id),
      activityStreak(session.id),
      db.bodyMeasurement.findFirst({ where: { userId: session.id, weightKg: { not: null } }, orderBy: { measuredOn: "desc" } }),
      db.bodyMeasurement.findFirst({ where: { userId: session.id, weightKg: { not: null } }, orderBy: { measuredOn: "asc" } }),
      Promise.resolve(resolveEnabledFlags()),
    ]);

    // Readiness fallback (compute on the fly if missing today)
    let readiness = readinessRow
      ? { score: readinessRow.score, state: readinessRow.state, isEstimated: readinessRow.isEstimated, factors: JSON.parse(readinessRow.factorsJson) as unknown[] }
      : null;
    if (!readiness) {
      const sleep = await db.sleepLog.findUnique({ where: { userId_logDate: { userId: session.id, logDate: today } } });
      const recent = await db.workoutSession.findMany({
        where: { userId: session.id, status: "completed" },
        orderBy: { startedAt: "desc" },
        take: 14,
        select: { startedAt: true, totalVolumeKg: true },
      });
      const load3 = recent.filter((s) => (Date.now() - s.startedAt.getTime()) < 3 * 86400000).reduce((a, s) => a + s.totalVolumeKg, 0);
      const load14 = recent.reduce((a, s) => a + s.totalVolumeKg, 0);
      const daysSince = recent.length > 0 ? Math.floor((Date.now() - recent[0].startedAt.getTime()) / 86400000) : null;
      const r = computeReadiness({
        sleepQualityScore: sleep?.qualityScore ?? null,
        sleepDurationMinutes: sleep?.durationMinutes ?? null,
        trainingLoadLast3Days: load3 || null,
        avgTrainingLoad14d: load14 || null,
        adherenceLast7d: null,
        daysSinceLastWorkout: daysSince,
      });
      readiness = { score: r.score, state: r.state, isEstimated: true, factors: r.factors };
      await db.readinessDaily.upsert({
        where: { userId_scoreDate: { userId: session.id, scoreDate: today } },
        create: {
          userId: session.id, scoreDate: today, score: r.score, state: r.state,
          calculationVersion: "v1", isEstimated: true, factorsJson: JSON.stringify(r.factors),
        },
        update: { score: r.score, state: r.state, factorsJson: JSON.stringify(r.factors) },
      }).catch(() => undefined);
    }

    // Nutrition totals derived from entries (never copied macros)
    const mealTotals = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
    for (const entry of mealsToday?.entries ?? []) {
      const mult = entry.quantity * entry.servingMultiplier;
      mealTotals.calories += entry.food.calories * mult;
      mealTotals.proteinG += entry.food.proteinG * mult;
      mealTotals.carbsG += entry.food.carbsG * mult;
      mealTotals.fatG += entry.food.fatG * mult;
    }

    const level = levelFromXp(xp);

    // ---- Adaptive coach guidance (flag-gated; deterministic rules) ----
    let coachGuidance: Awaited<ReturnType<typeof adaptiveCoach>> | null = null;
    if (flags.ADAPTIVE_COACH) {
      const [lastCompleted, sessions14d, prRecent] = await Promise.all([
        db.workoutSession.findFirst({
          where: { userId: session.id, status: "completed" },
          orderBy: { startedAt: "desc" },
          include: { exerciseLogs: { include: { sets: { select: { rpe: true } } } } },
        }),
        db.workoutSession.count({
          where: {
            userId: session.id,
            status: "completed",
            startedAt: { gte: new Date(Date.now() - 14 * 86_400_000) },
          },
        }),
        db.personalRecord.findFirst({
          where: { userId: session.id, achievedAt: { gte: new Date(Date.now() - 21 * 86_400_000) } },
          select: { id: true },
        }),
      ]);
      const lastRpe = (() => {
        if (!lastCompleted) return null;
        const rpes = lastCompleted.exerciseLogs.flatMap((l) => l.sets.map((st) => st.rpe)).filter((v): v is number => v != null);
        return rpes.length > 0 ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
      })();
      const daysSinceLast = lastCompleted
        ? Math.floor((Date.now() - lastCompleted.startedAt.getTime()) / 86_400_000)
        : null;
      const weeklyTarget = profile?.weeklyWorkoutTarget ?? 3;
      // Lightweight plateau proxy: no PR in 21d with meaningful recent volume.
      const plateauDetected = prRecent == null && sessions14d >= 6;

      coachGuidance = adaptiveCoach({
        readiness: readiness ? { score: readiness.score, state: readiness.state as ReadinessState } : null,
        lastSessionRpe: lastRpe,
        daysSinceLastSession: daysSinceLast,
        sessionsLast14d: sessions14d,
        weeklyTarget,
        plateauDetected,
      });
    }

    // ---- Active goals with live progress (flag-gated) ----
    let goalCards: Array<{ id: string; title: string; percent: number; statusFa: string }> = [];
    if (flags.GOAL_ENGINE) {
      const goalRows = await db.goal.findMany({
        where: { userId: session.id, status: "active" },
        orderBy: { createdAt: "desc" },
        take: 3,
      });
      goalCards = await Promise.all(
        goalRows.map(async (g) => {
          const current = await currentValueForGoal(session.id, g, today);
          const progress = computeGoalProgress(g, current, today);
          return {
            id: g.id,
            title: g.title || (g.type === "weight" ? "هدف وزن" : "هدف تمرین"),
            percent: progress.percent,
            statusFa: progress.statusFa,
          };
        }),
      );
    }

    return NextResponse.json({
      ok: true,
      greetingName: session.displayName,
      tier: session.tier,
      today,
      readiness,
      todayWorkout: planDay && !todaySession
        ? {
            planDayId: planDay.id,
            name: planDay.name,
            isRest: planDay.isRestDay,
            exerciseCount: planDay.exercises.length,
            estimatedMinutes: Math.round(planDay.exercises.reduce((a, e) => a + e.targetSets * (e.restSeconds + 60), 0) / 60),
          }
        : null,
      activeSession: todaySession ? { id: todaySession.id, name: todaySession.name } : null,
      nutrition: {
        totals: {
          calories: Math.round(mealTotals.calories),
          proteinG: Math.round(mealTotals.proteinG),
          carbsG: Math.round(mealTotals.carbsG),
          fatG: Math.round(mealTotals.fatG),
        },
        targets: profile
          ? {
              calories: profile.dailyCalorieTarget ?? 2400,
              proteinG: profile.dailyProteinTarget ?? 150,
              carbsG: profile.dailyCarbTarget ?? 300,
              fatG: profile.dailyFatTarget ?? 70,
            }
          : null,
        entryCount: mealsToday?.entries.length ?? 0,
      },
      water: {
        ml: waterToday._sum.ml ?? 0,
        targetMl: profile?.dailyWaterTargetMl ?? 2500,
      },
      weight: latestWeight?.weightKg
        ? { current: latestWeight.weightKg, deltaFromStart: latestWeight.weightKg - (firstWeight?.weightKg ?? latestWeight.weightKg) }
        : null,
      gamification: {
        xp,
        level: level.level,
        levelProgress: level.progress,
        streakDays: streak,
      },
      coachGuidance,
      goals: goalCards,
      flags,
      tz,
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
