import "server-only";
import { db } from "@/lib/db";
import { isoDateOnly } from "@/lib/dates/jalali";
import { suggestNextLoad, type LoadSuggestion, type LoggedSet } from "@/lib/workout/progression";

export type LastPerformance = {
  /** Local calendar day of that session (ISO date). */
  date: string;
  sets: Array<{ weightKg: number | null; reps: number | null; rpe: number | null }>;
};

export type ExerciseHistory = {
  last: LastPerformance | null;
  suggestion: LoadSuggestion | null;
};

/**
 * Most recent completed performance per exercise (working sets only), so the live
 * session can open pre-filled instead of on empty inputs.
 */
export async function loadLastPerformance(
  userId: string,
  exerciseIds: string[],
  timezone: string,
  excludeSessionId?: string,
): Promise<Map<string, LastPerformance>> {
  const out = new Map<string, LastPerformance>();
  if (exerciseIds.length === 0) return out;

  const logs = await db.exerciseLog.findMany({
    where: {
      exerciseId: { in: exerciseIds },
      session: { userId, status: "completed", ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}) },
    },
    orderBy: { session: { startedAt: "desc" } },
    take: exerciseIds.length * 6,
    select: {
      exerciseId: true,
      session: { select: { startedAt: true } },
      sets: { where: { isWarmup: false }, orderBy: { setNumber: "asc" }, select: { weightKg: true, reps: true, rpe: true } },
    },
  });

  for (const log of logs) {
    if (out.has(log.exerciseId) || log.sets.length === 0) continue;
    out.set(log.exerciseId, { date: isoDateOnly(log.session.startedAt, timezone), sets: log.sets });
  }
  return out;
}

/** Attach `history` (last time + today's suggested load) to each live-session exercise. */
export async function attachHistory<
  T extends { exerciseId: string; targetRepsMin: number; targetRepsMax: number },
>(
  userId: string,
  timezone: string,
  exercises: T[],
  excludeSessionId?: string,
): Promise<Array<T & { equipment: string; history: ExerciseHistory }>> {
  const ids = [...new Set(exercises.map((e) => e.exerciseId))];
  const [last, rows] = await Promise.all([
    loadLastPerformance(userId, ids, timezone, excludeSessionId),
    db.exercise.findMany({ where: { id: { in: ids } }, select: { id: true, equipment: true } }),
  ]);
  const equipmentById = new Map(rows.map((r) => [r.id, r.equipment]));

  return exercises.map((ex) => {
    const equipment = equipmentById.get(ex.exerciseId) ?? "machine";
    const lastPerf = last.get(ex.exerciseId) ?? null;
    const suggestion = lastPerf
      ? suggestNextLoad({
          lastSets: lastPerf.sets as LoggedSet[],
          repsMin: ex.targetRepsMin,
          repsMax: ex.targetRepsMax,
          equipment,
        })
      : null;
    return { ...ex, equipment, history: { last: lastPerf, suggestion } };
  });
}
