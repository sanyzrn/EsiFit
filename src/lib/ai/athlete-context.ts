import "server-only";
import { db } from "@/lib/db";

/** Caller must establish self ownership or an active coach roster link first. */
export async function readAthleteContext(userId: string) {
  const [
    profile,
    plans,
    workouts,
    nutrition,
    readiness,
    measurement,
    goals,
    nutritionTarget,
  ] = await Promise.all([
    db.userProfile.findUnique({ where: { userId } }),
    db.workoutPlan.findMany({
      where: { userId, status: "active" },
      take: 1,
      include: {
        days: {
          orderBy: [{ weekNumber: "asc" }, { dayNumber: "asc" }],
          take: 7,
          include: {
            exercises: {
              orderBy: { orderIndex: "asc" },
              take: 12,
              include: { exercise: { select: { nameFa: true } } },
            },
          },
        },
      },
    }),
    db.workoutSession.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: 5,
      select: {
        name: true,
        status: true,
        startedAt: true,
        durationSeconds: true,
        totalVolumeKg: true,
      },
    }),
    db.nutritionDay.findMany({
      where: { userId },
      orderBy: { logDate: "desc" },
      take: 3,
      include: {
        entries: {
          take: 30,
          include: {
            food: {
              select: {
                nameFa: true,
                servingAmount: true,
                servingUnit: true,
                calories: true,
                proteinG: true,
                carbsG: true,
                fatG: true,
              },
            },
          },
        },
      },
    }),
    db.readinessDaily.findFirst({
      where: { userId },
      orderBy: { scoreDate: "desc" },
    }),
    db.bodyMeasurement.findFirst({
      where: { userId },
      orderBy: { measuredOn: "desc" },
    }),
    db.goal.findMany({ where: { userId, status: "active" }, take: 5 }),
    db.nutritionTarget.findFirst({
      where: { userId },
      orderBy: { effectiveFrom: "desc" },
    }),
  ]);
  return {
    profile,
    measurement,
    readiness,
    nutritionTarget,
    nutrition,
    goals,
    workouts,
    plans,
  };
}
