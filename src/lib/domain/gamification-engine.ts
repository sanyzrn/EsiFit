import "server-only";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";

/**
 * Gamification engine — XP is an append-only ledger with idempotent
 * (userId, sourceType, sourceId) keys; badges and mission progress are
 * derived/updated after every relevant event. Same event can never
 * double-award XP (unique constraint + pre-check).
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
  await db.xpLog.create({ data: params });
  return { awarded: true };
}

export async function getXpTotal(userId: string): Promise<number> {
  const agg = await db.xpLog.aggregate({ where: { userId }, _sum: { amount: true } });
  return agg._sum.amount ?? 0;
}

/** Post-event badge + mission evaluation. Returns newly earned badge slugs. */
export async function evaluateAfterWorkout(userId: string, sessionId: string): Promise<string[]> {
  const now = new Date();
  const newBadges: string[] = [];

  const [sessionCount, prCount, sessions] = await Promise.all([
    db.workoutSession.count({ where: { userId, status: "completed" } }),
    db.personalRecord.count({ where: { userId, recordType: "weight" } }),
    db.workoutSession.findMany({
      where: { userId, status: "completed" },
      orderBy: { startedAt: "desc" },
      take: 60,
      select: { startedAt: true, totalVolumeKg: true },
    }),
  ]);

  const totalVolume = sessions.reduce((a, s) => a + s.totalVolumeKg, 0);

  // Streak: consecutive training days (>=1 completed session per day)
  const daySet = new Set(sessions.map((s) => s.startedAt.toISOString().slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  // tolerate today not trained yet
  if (!daySet.has(cursor.toISOString().slice(0, 10))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (daySet.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  const badges = await db.badge.findMany();
  for (const b of badges) {
    const qualifies =
      (b.criteriaType === "workout_count" && sessionCount >= b.criteriaValue) ||
      (b.criteriaType === "pr_count" && prCount >= b.criteriaValue) ||
      (b.criteriaType === "streak" && streak >= b.criteriaValue) ||
      (b.criteriaType === "volume" && totalVolume >= b.criteriaValue);
    if (!qualifies) continue;
    const created = await db.userBadge
      .create({ data: { userId, badgeId: b.id, earnedAt: now } })
      .catch(() => null);
    if (created) {
      newBadges.push(b.nameFa);
      await awardXp({ userId, amount: 40, sourceType: "badge", sourceId: b.id });
      await db.notification.create({
        data: {
          userId, type: "achievement", title: `نشان «${b.nameFa}» فعال شد`,
          body: b.descriptionFa, actionUrl: "/achievements",
        },
      });
    }
  }

  // Daily mission: workout
  const today = now.toISOString().slice(0, 10);
  const mission = await db.mission.findUnique({ where: { slug: "daily-workout" } });
  if (mission) {
    await db.userMissionProgress.upsert({
      where: { userId_missionId_periodKey: { userId, missionId: mission.id, periodKey: today } },
      create: { userId, missionId: mission.id, periodKey: today, progress: 1, target: mission.target, completedAt: now },
      update: { progress: { increment: 1 } },
    }).catch(() => undefined);
  }
  const setsMission = await db.mission.findUnique({ where: { slug: "daily-sets" } });

  return newBadges;
}

/** Claim a completed mission — idempotent, server-verified. */
export async function claimMission(userId: string, missionId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const progress = await db.userMissionProgress.findUnique({
    where: { userId_missionId_periodKey: { userId, missionId, periodKey: today } },
  });
  if (!progress) throw new AppError("not_found", { userMessage: "این ماموریت امروز فعال نیست." });
  if (progress.claimed) throw new AppError("conflict", { userMessage: "این ماموریت قبلاً جمع‌آوری شده است." });
  if (progress.progress < progress.target) {
    throw new AppError("validation", { userMessage: "ماموریت هنوز کامل نشده است." });
  }
  await db.userMissionProgress.update({ where: { id: progress.id }, data: { claimed: true } });
  const mission = await db.mission.findUniqueOrThrow({ where: { id: missionId } });
  await awardXp({ userId, amount: mission.xpReward, sourceType: "mission", sourceId: `${missionId}-${today}` });
  return { xp: mission.xpReward };
}

/** Streak of days with any training OR water OR nutrition activity. */
export async function activityStreak(userId: string): Promise<number> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 60);
  const [sessions, waters] = await Promise.all([
    db.workoutSession.findMany({
      where: { userId, status: "completed", startedAt: { gte: since } },
      select: { startedAt: true },
    }),
    db.waterLog.findMany({
      where: { userId, loggedAt: { gte: since } },
      select: { loggedAt: true },
    }),
  ]);
  const days = new Set<string>();
  for (const s of sessions) days.add(s.startedAt.toISOString().slice(0, 10));
  for (const w of waters) days.add(w.loggedAt.toISOString().slice(0, 10));
  let streak = 0;
  const cursor = new Date();
  if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
