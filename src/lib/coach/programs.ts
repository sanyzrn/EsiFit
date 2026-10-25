import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { todayISO } from "@/lib/dates/jalali";
import { parseAvailableEquipment } from "@/lib/workout/equipment";
import type { CoachProgramInput } from "./program-contract";

/** Recheck relationship and roles under row locks, including revoked links. */
export async function lockCoachAthlete(tx: Prisma.TransactionClient, coachId: string, athleteId: string) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${athleteId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "CoachClient" WHERE "coachId" = ${coachId} AND "athleteId" = ${athleteId} FOR UPDATE`;
  const [coach, athlete, link] = await Promise.all([
    tx.user.findUnique({ where: { id: coachId } }), tx.user.findUnique({ where: { id: athleteId } }),
    tx.coachClient.findUnique({ where: { coachId_athleteId: { coachId, athleteId } } }),
  ]);
  if (coach?.role !== "coach" || coach.status !== "active" || athlete?.role !== "member" || athlete.status !== "active" || link?.status !== "active") throw AppError.from("authorization", "فقط پروندهٔ ورزشکار فعال خودت قابل ویرایش است.");
  return { athlete, link };
}

export async function assignCoachProgram(coachId: string, input: CoachProgramInput) {
  return db.$transaction(async tx => {
    const { athlete } = await lockCoachAthlete(tx, coachId, input.athleteId);
    const current = await tx.workoutPlan.findFirst({ where: { userId: athlete.id, status: "active" }, orderBy: { createdAt: "desc" } });
    if ((current?.id ?? null) !== input.sourcePlanId) throw AppError.from("conflict", "برنامه از زمان بازکردن پرونده تغییر کرده است؛ صفحه را تازه کن.");
    const profile = await tx.userProfile.findUnique({ where: { userId: athlete.id } });
    const equipment = parseAvailableEquipment(profile?.availableEquipment);
    const slugs = [...new Set(input.days.flatMap(d => d.exercises.map(e => e.slug)))];
    const exercises = await tx.exercise.findMany({ where: { slug: { in: slugs } } });
    const bySlug = new Map(exercises.map(e => [e.slug, e]));
    for (const slug of slugs) {
      const exercise = bySlug.get(slug);
      if (!exercise) throw AppError.from("validation", "یک حرکت در کتابخانه موجود نیست؛ فهرست را تازه کن.");
      if (equipment && !equipment.has(exercise.equipment)) throw AppError.from("validation", `وسایل «${exercise.nameFa}» در پروفایل ورزشکار در دسترس نیست.`);
    }
    await tx.workoutPlan.updateMany({ where: { userId: athlete.id, status: "active" }, data: { status: "archived" } });
    const plan = await tx.workoutPlan.create({ data: {
      userId: athlete.id, name: input.name, goalType: input.goalType, description: input.description,
      weeks: input.weeks, startsOn: todayISO(athlete.timezone), status: "active",
    } });
    await tx.userProfile.upsert({ where: { userId: athlete.id }, create: { userId: athlete.id, weeklyWorkoutTarget: input.days.filter(d => !d.isRest).length }, update: { weeklyWorkoutTarget: input.days.filter(d => !d.isRest).length } });
    // Explicit coach prescriptions repeat unchanged. No hidden progression.
    for (let weekNumber = 1; weekNumber <= input.weeks; weekNumber++) {
      for (const [index, day] of input.days.entries()) {
        const saved = await tx.workoutPlanDay.create({ data: { planId: plan.id, weekNumber, dayNumber: index + 1, name: day.name, focusRegion: day.focusRegion, isRestDay: Boolean(day.isRest) } });
        if (day.exercises.length) await tx.plannedExercise.createMany({ data: day.exercises.map((e, orderIndex) => ({ planDayId: saved.id, exerciseId: bySlug.get(e.slug)!.id, orderIndex, targetSets: e.sets, targetRepsMin: e.repsMin, targetRepsMax: e.repsMax, targetRpe: e.rpe, restSeconds: e.rest, note: e.note ?? "" })) });
      }
    }
    await tx.notification.create({ data: { userId: athlete.id, type: "system", title: "برنامه جدید از مربی", body: `برنامه «${plan.name}» از امروز فعال است. برنامه و توضیحات مربی را بررسی کن.` } });
    return plan;
  }, { timeout: 30000, maxWait: 10000 });
}
