import "server-only";
import type { Prisma } from "@prisma/client";
import { currentDayStreak, longestDayStreak } from "@/lib/domain/activity-streak";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { todayISO, isoDateOnly, weekStartISO, localDayStartUTC, localDayEndUTC, isValidISODate, addDaysISO } from "@/lib/dates/jalali";

/**
 * Gamification engine — XP is an append-only ledger with idempotent
 * (userId, sourceType, sourceId) keys; badges and mission progress are
 * derived/updated after every relevant event. Same event can never
 * double-award XP (unique constraint + pre-check + P2002 catch).
 */

export async function awardXp(params: {
  userId: string;
  amount: number;
  sourceType: string;
  sourceId: string;
}): Promise<{ awarded: boolean }> {
  const exists = await db.xpLog.findUnique({
    where: {
      userId_sourceType_sourceId: {
        userId: params.userId,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
      },
    },
  });
  if (exists) return { awarded: false };
  try {
    await db.xpLog.create({ data: params });
    return { awarded: true };
  } catch {
    // Concurrent create lost the unique race — treat as already awarded.
    return { awarded: false };
  }
}

export async function getXpTotal(userId: string): Promise<number> {
  const agg = await db.xpLog.aggregate({ where: { userId }, _sum: { amount: true } });
  return agg._sum.amount ?? 0;
}

async function userTimezone(userId: string): Promise<string> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  return user?.timezone ?? "Asia/Tehran";
}

const workingSetWhere = {
  isWarmup: false,
  OR: [{ reps: { gt: 0 } }, { durationSeconds: { gt: 0 } }],
} satisfies Prisma.SetLogWhereInput;

function completedWorkouts(userId: string): Prisma.WorkoutSessionWhereInput {
  return { userId, status: "completed", startedAt: { lte: new Date() },
    exerciseLogs: { some: { sets: { some: workingSetWhere } } } };
}

async function activityFacts(userId: string, timezone: string) {
  const today = todayISO(timezone);
  const [sessions, waters, meals] = await Promise.all([
    db.workoutSession.findMany({ where: completedWorkouts(userId), select: { startedAt: true, totalVolumeKg: true } }),
    db.waterLog.groupBy({ by: ["logDate"], where: { userId, logDate: { lte: today }, loggedAt: { lte: new Date() } }, _sum: { ml: true } }),
    db.nutritionDay.findMany({ where: { userId, logDate: { lte: today }, entries: { some: {} } }, select: { logDate: true } }),
  ]);
  const trainingDays = sessions.map(s => isoDateOnly(s.startedAt, timezone));
  const activityDays = [...trainingDays, ...waters.map(w => w.logDate), ...meals.map(m => m.logDate)];
  return { today, sessions, waters, meals, activityDays };
}

/** Shared evaluation: event handlers and achievements catch-up use the same facts.
 * Badge, XP and notification are committed together and can only be awarded once. */
export async function evaluateBadges(userId: string): Promise<string[]> {
  const tz = await userTimezone(userId);
  const [facts, profile, prCount, badges] = await Promise.all([
    activityFacts(userId, tz),
    db.userProfile.findUnique({ where: { userId }, select: { dailyWaterTargetMl: true } }),
    db.personalRecord.count({ where: { userId, recordType: "weight", achievedAt: { lte: new Date() } } }),
    db.badge.findMany({ where: { earnedBy: { none: { userId } } } }),
  ]);
  const values: Record<string, number> = {
    workout_count: facts.sessions.length,
    pr_count: prCount,
    volume: facts.sessions.reduce((sum, session) => sum + session.totalVolumeKg, 0),
    streak: longestDayStreak(facts.activityDays),
    water_days: longestDayStreak(facts.waters.filter(w => (w._sum.ml ?? 0) >= (profile?.dailyWaterTargetMl ?? 2500)).map(w => w.logDate)),
    nutrition_days: longestDayStreak(facts.meals.map(m => m.logDate)),
    early: facts.sessions.filter(s => Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(s.startedAt)) < 8).length,
  };
  const awarded: string[] = [];
  for (const badge of badges) {
    if (!(badge.criteriaType in values) || values[badge.criteriaType] < badge.criteriaValue) continue;
    try {
      await db.$transaction(async tx => {
        await tx.userBadge.create({ data: { userId, badgeId: badge.id } });
        await tx.xpLog.create({ data: { userId, amount: 40, sourceType: "badge", sourceId: badge.id } });
        await tx.notification.create({ data: { userId, type: "achievement", title: `نشان «${badge.nameFa}» فعال شد`, body: badge.descriptionFa, actionUrl: "/achievements" } });
      });
      awarded.push(badge.nameFa);
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
  }
  return awarded;
}

/** Completed workout only; no empty or warmup-only event can advance rewards. */
export async function evaluateAfterWorkout(userId: string, sessionId: string): Promise<string[]> {
  const session = await db.workoutSession.findFirst({ where: { ...completedWorkouts(userId), id: sessionId }, select: { id: true, startedAt: true } });
  if (!session) return [];
  const timezone = await userTimezone(userId);
  await refreshDerivedMissions(userId, timezone, isoDateOnly(session.startedAt, timezone));
  return evaluateBadges(userId);
}

/** Claim a completed mission — idempotent, server-verified. */
export async function claimMission(userId: string, missionId: string, requestedPeriod?: string) {
  const tz = await userTimezone(userId);
  const today = todayISO(tz);
  const mission = await db.mission.findUnique({ where: { id: missionId } });
  if (!mission) throw new AppError("not_found");
  const currentPeriod = mission.period === "weekly" ? weekStartISO(today) : today;
  const periodKey = requestedPeriod ?? currentPeriod;
  if (!isValidISODate(periodKey) || periodKey > currentPeriod || (mission.period === "weekly" && weekStartISO(periodKey) !== periodKey)) {
    throw new AppError("validation", { userMessage: "دورهٔ ماموریت معتبر نیست." });
  }
  if (periodKey === currentPeriod) {
    if (!mission.active) throw new AppError("not_found");
    await refreshDerivedMissions(userId, tz);
  }
  return db.$transaction(async tx => {
    const progress = await tx.userMissionProgress.findUnique({ where: { userId_missionId_periodKey: { userId, missionId, periodKey } } });
    if (!progress) throw new AppError("not_found", { userMessage: "پاداشی برای این دوره ثبت نشده است." });
    if (progress.claimed) throw new AppError("conflict", { userMessage: "این ماموریت قبلاً جمع‌آوری شده است." });
    if (progress.progress < progress.target) throw new AppError("validation", { userMessage: "ماموریت هنوز کامل نشده است." });
    const claimed = await tx.userMissionProgress.updateMany({ where: { id: progress.id, claimed: false }, data: { claimed: true } });
    if (claimed.count === 0) throw new AppError("conflict", { userMessage: "این ماموریت قبلاً جمع‌آوری شده است." });
    await tx.xpLog.upsert({
      where: { userId_sourceType_sourceId: { userId, sourceType: "mission", sourceId: `${missionId}-${periodKey}` } },
      create: { userId, amount: mission.xpReward, sourceType: "mission", sourceId: `${missionId}-${periodKey}` }, update: {},
    });
    await tx.notification.create({ data: { userId, type: "achievement", title: `پاداش «${mission.nameFa}» دریافت شد`, body: `${mission.xpReward} امتیاز تجربه برای دورهٔ ${periodKey} به شما اضافه شد.`, actionUrl: "/achievements" } });
    return { xp: mission.xpReward };
  });
}

/** Current activity streak; nutrition counts too, and history has no 60-day cap. */
export async function activityStreak(userId: string): Promise<number> {
  const tz = await userTimezone(userId);
  const facts = await activityFacts(userId, tz);
  return currentDayStreak(facts.activityDays, facts.today);
}

/** Recompute derived missions from real data; replay and deletion cannot inflate
 * progress. A claimed reward remains claimed for its period. */
export async function refreshDerivedMissions(userId: string, timezone: string, referenceDay = todayISO(timezone)) {
  const today = referenceDay;
  const week = weekStartISO(today);
  const weekEnd = [addDaysISO(week, 6), todayISO(timezone)].sort()[0];
  const [missions, sets, profile, days, water, workouts] = await Promise.all([
    db.mission.findMany({ where: { active: true, slug: { in: ["daily-sets", "weekly-protein", "daily-water", "daily-workout"] } } }),
    db.setLog.count({ where: { userId, isWarmup: false,
      OR: [{ reps: { gt: 0 } }, { durationSeconds: { gt: 0 } }],
      completedAt: { gte: localDayStartUTC(today, timezone), lt: localDayEndUTC(today, timezone), lte: new Date() } } }),
    db.userProfile.findUnique({ where: { userId }, select: { dailyProteinTarget: true } }),
    db.nutritionDay.findMany({ where: { userId, logDate: { gte: week, lte: weekEnd } }, include: { entries: { include: { food: true } } } }),
    db.waterLog.aggregate({ where: { userId, logDate: today, loggedAt: { lte: new Date() } }, _sum: { ml: true } }),
    db.workoutSession.count({ where: { ...completedWorkouts(userId), startedAt: { gte: localDayStartUTC(today, timezone), lt: localDayEndUTC(today, timezone), lte: new Date() } } }),
  ]);
  const proteinTarget = profile?.dailyProteinTarget ?? 150;
  const proteinDays = days.filter(day => proteinTarget > 0 && day.entries.reduce((sum, entry) =>
    sum + entry.food.proteinG * entry.quantity * entry.servingMultiplier, 0) >= proteinTarget).length;
  for (const mission of missions) {
    const periodKey = mission.period === "weekly" ? week : today;
    const progress = mission.slug === "daily-sets" ? sets
      : mission.slug === "weekly-protein" ? proteinDays
      : mission.slug === "daily-water" ? (water._sum.ml ?? 0) : workouts;
    const completedAt = progress >= mission.target ? new Date() : null;
    await db.userMissionProgress.upsert({
      where: { userId_missionId_periodKey: { userId, missionId: mission.id, periodKey } },
      create: { userId, missionId: mission.id, periodKey, target: mission.target, progress, completedAt },
      update: { target: mission.target, progress, completedAt },
    });
  }
}
