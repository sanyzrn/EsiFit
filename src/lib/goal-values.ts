import "server-only";
import { db } from "@/lib/db";
import { lastNDaysISO } from "@/lib/dates/jalali";

/**
 * Resolves the *current live value* of a goal from the user's data.
 * Used by the athlete goals API and the coach athlete-detail view so both
 * always show the same number (TECH_ARCHITECTURE: single repository function
 * per domain question).
 */
export async function currentValueForGoal(
  userId: string,
  goal: {
    id: string;
    type: string;
    startValue: number;
    metaJson?: string | null;
  },
  todayISO: string,
): Promise<number> {
  switch (goal.type) {
    case "weight": {
      const latest = await db.bodyMeasurement.findFirst({
        where: { userId, weightKg: { not: null } },
        orderBy: { measuredOn: "desc" },
        select: { weightKg: true },
      });
      return latest?.weightKg ?? goal.startValue;
    }

    case "workout_frequency": {
      // Target is sessions per week — current = trailing 7-day average of
      // completed sessions (×7).
      const since = lastNDaysISO(28)[0];
      const count = await db.workoutSession.count({
        where: {
          userId,
          status: "completed",
          startedAt: { gte: new Date(`${since}T00:00:00Z`) },
        },
      });
      return Math.round((count / 4) * 10) / 10;
    }

    case "strength": {
      // metaJson.exerciseSlug scopes the record; fallback = strongest current PR.
      let exerciseSlug: string | null = null;
      try {
        exerciseSlug = (JSON.parse(goal.metaJson ?? "{}") as { exerciseSlug?: string }).exerciseSlug ?? null;
      } catch {
        exerciseSlug = null;
      }
      const pr = await db.personalRecord.findFirst({
        where: {
          userId,
          isCurrent: true,
          recordType: "weight",
          ...(exerciseSlug ? { exercise: { slug: exerciseSlug } } : {}),
        },
        orderBy: { value: "desc" },
        select: { value: true },
      });
      return pr?.value ?? goal.startValue;
    }

    case "volume": {
      // Average weekly tonnage over the last 4 weeks.
      const since = lastNDaysISO(28)[0];
      const sessions = await db.workoutSession.findMany({
        where: {
          userId,
          status: "completed",
          startedAt: { gte: new Date(`${since}T00:00:00Z`) },
        },
        select: { totalVolumeKg: true },
      });
      const total = sessions.reduce((s, x) => s + x.totalVolumeKg, 0);
      return Math.round(total / 4);
    }

    case "nutrition_log": {
      // Total logged days in the last 28 (target may be e.g. 24).
      const since = lastNDaysISO(28)[0];
      return db.nutritionDay.count({
        where: { userId, logDate: { gte: since }, entries: { some: {} } },
      });
    }

    default:
      return goal.startValue;
  }
}
