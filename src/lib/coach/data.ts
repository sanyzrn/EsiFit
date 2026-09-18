import "server-only";
import { db } from "@/lib/db";
import { activityStreak } from "@/lib/domain/gamification-engine";
import { todayISO, lastNDaysISO } from "@/lib/dates/jalali";
import { computeGoalProgress } from "@/lib/domain/goals";
import { currentValueForGoal } from "@/lib/goal-values";

/**
 * Coach workspace data layer — one place for roster + athlete detail queries,
 * consumed by both the API routes and the server components.
 */

export type RosterEntry = {
  athleteId: string;
  displayName: string;
  tier: string;
  planName: string | null;
  sessions7d: number;
  sessions28d: number;
  weeklyTarget: number;
  adherencePct: number; // 0..100 vs weekly target over last 28d
  readiness: { score: number; state: string } | null;
  lastSessionAt: string | null;
  volume7dKg: number;
  prs30d: number;
  activeGoals: number;
  note: string;
  /** Coaching alert (Persian) when signals demand attention; null otherwise. */
  alertFa: string | null;
};

export async function getCoachRoster(coachId: string): Promise<RosterEntry[]> {
  const today = todayISO();
  const iso7 = lastNDaysISO(7)[0];
  const iso28 = lastNDaysISO(28)[0];

  const links = await db.coachClient.findMany({
    where: { coachId, status: "active" },
    orderBy: { startedAt: "asc" },
    // Cap roster batch size — large coaches get the first page of athletes
    // with the same aggregation shape (pagination UI can slice further).
    take: 200,
  });
  if (links.length === 0) return [];
  const ids = links.map((l) => l.athleteId);

  const [athletes, profiles, sessions, readiness, prs, goals, activePlans] = await Promise.all([
    db.user.findMany({ where: { id: { in: ids }, status: "active" } }),
    db.userProfile.findMany({ where: { userId: { in: ids } } }),
    db.workoutSession.findMany({
      where: { userId: { in: ids }, status: "completed", startedAt: { gte: new Date(`${iso28}T00:00:00Z`) } },
      select: { userId: true, startedAt: true, totalVolumeKg: true },
      orderBy: { startedAt: "asc" },
    }),
    db.readinessDaily.findMany({
      where: { userId: { in: ids }, scoreDate: today },
      select: { userId: true, score: true, state: true },
    }),
    db.personalRecord.findMany({
      where: { userId: { in: ids }, achievedAt: { gte: new Date(`${lastNDaysISO(30)[0]}T00:00:00Z`) } },
      select: { userId: true },
    }),
    db.goal.findMany({ where: { userId: { in: ids }, status: "active" } }),
    db.workoutPlan.findMany({
      where: { userId: { in: ids }, status: "active" },
      select: { userId: true, name: true },
    }),
  ]);

  const profileByUser = new Map(profiles.map((p) => [p.userId, p]));
  const readinessByUser = new Map(readiness.map((r) => [r.userId, r]));
  const planByUser = new Map(activePlans.map((p) => [p.userId, p.name]));
  const prByUser = new Map<string, number>();
  for (const pr of prs) prByUser.set(pr.userId, (prByUser.get(pr.userId) ?? 0) + 1);

  const iso7Time = new Date(`${iso7}T00:00:00Z`).getTime();

  return links
    .map((link) => {
      const athlete = athletes.find((a) => a.id === link.athleteId);
      if (!athlete) return null;
      const profile = profileByUser.get(athlete.id);
      const mine = sessions.filter((s) => s.userId === athlete.id);
      const sessions7d = mine.filter((s) => s.startedAt.getTime() >= iso7Time).length;
      const sessions28d = mine.length;
      const volume7dKg = mine
        .filter((s) => s.startedAt.getTime() >= iso7Time)
        .reduce((sum, s) => sum + s.totalVolumeKg, 0);
      const weeklyTarget = profile?.weeklyWorkoutTarget ?? 3;
      const expected28 = Math.max(4, weeklyTarget * 4);
      const adherencePct = Math.min(100, Math.round((sessions28d / expected28) * 100));
      const lastSession = mine.length > 0 ? mine[mine.length - 1] : null;
      const daysSinceLast = lastSession
        ? Math.floor((Date.now() - lastSession.startedAt.getTime()) / 86_400_000)
        : null;

      // Coaching alert — deterministic precedence.
      let alertFa: string | null = null;
      if (daysSinceLast != null && daysSinceLast >= 7) {
        alertFa = `${toFa(daysSinceLast)} روز بدون تمرین — پیگیر برگشت به برنامه باش`;
      } else if (adherencePct < 50) {
        alertFa = "پیوستگی زیر ۵۰٪ هدف است — برنامه را سبک‌تر یا واقعی‌تر کن";
      } else if (readinessByUser.get(athlete.id)?.state === "recover") {
        alertFa = "آمادگی امروز پایین است — جلسه سبک توصیه می‌شود";
      }

      const r = readinessByUser.get(athlete.id);

      return {
        athleteId: athlete.id,
        displayName: athlete.displayName,
        tier: athlete.tier,
        planName: planByUser.get(athlete.id) ?? null,
        sessions7d,
        sessions28d,
        weeklyTarget,
        adherencePct,
        readiness: r ? { score: r.score, state: r.state } : null,
        lastSessionAt: lastSession ? lastSession.startedAt.toISOString() : null,
        volume7dKg,
        prs30d: prByUser.get(athlete.id) ?? 0,
        activeGoals: goals.filter((g) => g.userId === athlete.id).length,
        note: link.note,
        alertFa,
      } satisfies RosterEntry;
    })
    .filter((x): x is RosterEntry => x !== null);
}

export type AthleteDetail = {
  athlete: { id: string; displayName: string; tier: string; createdAt: string };
  profile: {
    heightCm: number | null;
    primaryGoal: string | null;
    experienceLevel: string | null;
    weeklyWorkoutTarget: number | null;
  } | null;
  planName: string | null;
  streakDays: number;
  weightTrend: Array<{ date: string; weightKg: number | null }>;
  weeklyTonnage: Array<{ weekStart: string; tonnageKg: number }>;
  recentSessions: Array<{ id: string; name: string; date: string; volumeKg: number; durationMinutes: number }>;
  currentPrs: Array<{ id: string; exerciseName: string; value: number; achievedAt: string }>;
  goals: Array<{ id: string; title: string; type: string; percent: number; statusFa: string; targetDate: string }>;
  readiness14: Array<{ scoreDate: string; score: number }>;
  activePain: Array<{ bodyRegion: string; severity: number; reportedOn: string; note: string }>;
};

export async function getCoachAthleteDetail(athleteId: string): Promise<AthleteDetail | null> {
  const athlete = await db.user.findUnique({
    where: { id: athleteId },
    select: { id: true, displayName: true, tier: true, status: true, createdAt: true },
  });
  if (!athlete || athlete.status !== "active") return null;

  const today = todayISO();
  const [profile, plan, streak, measurements, sessions, prs, goals, readiness, pain, allSessions] =
    await Promise.all([
      db.userProfile.findUnique({ where: { userId: athleteId } }),
      db.workoutPlan.findFirst({ where: { userId: athleteId, status: "active" }, select: { name: true } }),
      activityStreak(athleteId),
      db.bodyMeasurement.findMany({
        where: { userId: athleteId, weightKg: { not: null } },
        orderBy: { measuredOn: "asc" },
        take: 60,
        select: { measuredOn: true, weightKg: true },
      }),
      db.workoutSession.findMany({
        where: { userId: athleteId, status: "completed" },
        orderBy: { startedAt: "desc" },
        take: 12,
        select: { id: true, name: true, startedAt: true, totalVolumeKg: true, durationSeconds: true },
      }),
      db.personalRecord.findMany({
        where: { userId: athleteId, isCurrent: true },
        include: { exercise: { select: { nameFa: true } } },
        orderBy: { value: "desc" },
        take: 8,
      }),
      db.goal.findMany({ where: { userId: athleteId, status: "active" } }),
      db.readinessDaily.findMany({
        where: { userId: athleteId },
        orderBy: { scoreDate: "desc" },
        take: 14,
        select: { scoreDate: true, score: true },
      }),
      db.painReport.findMany({
        where: { userId: athleteId, status: "active" },
        orderBy: { reportedOn: "desc" },
        take: 5,
      }),
      db.workoutSession.findMany({
        where: { userId: athleteId, status: "completed", startedAt: { gte: new Date(Date.now() - 8 * 7 * 86_400_000) } },
        select: { startedAt: true, totalVolumeKg: true },
        orderBy: { startedAt: "asc" },
      }),
    ]);

  // Weekly tonnage buckets (last 8 weeks).
  const buckets = new Map<string, number>();
  for (const s of allSessions) {
    const weeksAgo = Math.floor((Date.now() - s.startedAt.getTime()) / (7 * 86_400_000));
    const d = new Date();
    d.setUTCHours(12, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - weeksAgo * 7);
    const weekStart = d.toISOString().slice(0, 10);
    buckets.set(weekStart, (buckets.get(weekStart) ?? 0) + s.totalVolumeKg);
  }
  const weeklyTonnage = [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekStart, tonnageKg]) => ({ weekStart, tonnageKg: Math.round(tonnageKg) }));

  return {
    athlete: {
      id: athlete.id,
      displayName: athlete.displayName,
      tier: athlete.tier,
      createdAt: athlete.createdAt.toISOString(),
    },
    profile: profile
      ? {
          heightCm: profile.heightCm,
          primaryGoal: profile.primaryGoal,
          experienceLevel: profile.experienceLevel,
          weeklyWorkoutTarget: profile.weeklyWorkoutTarget,
        }
      : null,
    planName: plan?.name ?? null,
    streakDays: streak,
    weightTrend: measurements.map((m) => ({ date: m.measuredOn, weightKg: m.weightKg })),
    weeklyTonnage,
    recentSessions: sessions.map((s) => ({
      id: s.id,
      name: s.name,
      date: s.startedAt.toISOString(),
      volumeKg: s.totalVolumeKg,
      durationMinutes: Math.round(s.durationSeconds / 60),
    })),
    currentPrs: prs.map((p) => ({
      id: p.id,
      exerciseName: p.exercise.nameFa,
      value: p.value,
      achievedAt: p.achievedAt.toISOString(),
    })),
    goals: await Promise.all(
      goals.map(async (g) => {
        const current = await currentValueForGoal(athleteId, g, today);
        const progress = computeGoalProgress(g, current, today);
        return {
          id: g.id,
          title: g.title || g.type,
          type: g.type,
          percent: progress.percent,
          statusFa: progress.statusFa,
          targetDate: g.targetDate,
        };
      }),
    ),
    readiness14: readiness.reverse().map((r) => ({ scoreDate: r.scoreDate, score: r.score })),
    activePain: pain.map((p) => ({
      bodyRegion: p.bodyRegion,
      severity: p.severity,
      reportedOn: p.reportedOn,
      note: p.note,
    })),
  };
}

function toFa(n: number): string {
  return String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}
