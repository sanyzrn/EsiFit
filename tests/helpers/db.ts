import "./../setup-env";
import { PrismaClient } from "@prisma/client";
import { EXERCISES } from "@/features/workouts/data/exercise-dataset";

/**
 * Shared test-DB helper: one PrismaClient per process, minimal deterministic
 * fixtures for API tests. The DB file (db/test.db) is wiped per run.
 */
export const db = new PrismaClient();

/**
 * Wipe + minimal fixtures (a slice of the real exercise dataset).
 * Deterministic; called per test (fast enough at this dataset size).
 */
export function ensureSeed(): Promise<void> {
  return (async () => {
    const tables = [
      db.coachClient, db.weeklyRecap, db.setLog, db.exerciseLog, db.workoutSession,
      db.plannedExercise, db.workoutPlanDay, db.workoutPlan, db.personalRecord,
      db.painReport, db.exerciseSwap, db.mealEntry, db.nutritionDay, db.nutritionTarget,
      db.waterLog, db.sleepLog, db.calculatorResult, db.readinessDaily, db.bodyMeasurement,
      db.goal, db.exerciseMuscle, db.exercise, db.muscleGroup, db.food, db.notification,
      db.postLike, db.comment, db.post, db.xpLog, db.userBadge, db.userMissionProgress,
      db.mission, db.badge, db.userProfile, db.session, db.otpCode, db.otpRequestLog,
      db.product, db.order, db.subscription, db.subscriptionPlan,
      db.user,
    ];
    for (const t of tables as Array<{ deleteMany(): Promise<unknown> }>) {
      await t.deleteMany();
    }

    // Muscle groups + a few exercises from the real dataset.
    const groups = [...new Map(EXERCISES.flatMap((e) => e.muscles.map((m) => [m.slug, m.slug] as const))).keys()];
    const mgIds = new Map<string, string>();
    for (const slug of groups) {
      const row = await db.muscleGroup.create({ data: { slug, nameFa: slug, region: "core" } });
      mgIds.set(slug, row.id);
    }
    const WANT = [
      "barbell-bench-press", "incline-bench-press", "incline-dumbbell-press",
      "dumbbell-shoulder-press", "overhead-press", "push-up", "barbell-row",
      "dumbbell-row", "seated-cable-row", "lat-pulldown", "pull-up", "barbell-squat",
      "leg-press", "leg-curl", "leg-extension", "romanian-deadlift", "biceps-curl",
      "hammer-curl", "triceps-pushdown", "lateral-raise", "face-pull", "calf-raise",
      "hip-thrust", "plank",
    ];
    for (const ex of EXERCISES.filter((e) => WANT.includes(e.slug))) {
      await db.exercise.create({
        data: {
          slug: ex.slug,
          nameFa: ex.nameFa,
          equipment: ex.equipment,
          movementPattern: ex.movementPattern,
          difficulty: ex.difficulty,
          isCompound: ex.isCompound,
          instructionsFa: ex.instructionsFa,
          muscles: {
            create: ex.muscles.map((m) => ({
              muscleGroupId: mgIds.get(m.slug)!,
              role: m.role,
              intensity: m.intensity,
            })),
          },
        },
      });
    }
  })();
}

/** Fresh user with profile. */
export async function createUser(phone: string, opts?: { role?: string; tier?: string; displayName?: string }) {
  const user = await db.user.create({
    data: {
      phone,
      displayName: opts?.displayName ?? "کاربر تست",
      role: opts?.role ?? "member",
      tier: opts?.tier ?? "free",
    },
  });
  await db.userProfile.create({ data: { userId: user.id, weeklyWorkoutTarget: 3, onboardedAt: new Date() } });
  return user;
}
