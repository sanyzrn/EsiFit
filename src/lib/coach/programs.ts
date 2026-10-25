import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { storeWorkoutProgram } from "@/lib/workout/program-storage";
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
    const plan = await storeWorkoutProgram(tx, athlete, input);
    await tx.aiPlanRun.updateMany({where:{athleteId:athlete.id,status:"needs_review",reviewRequestedAt:{not:null}},data:{status:"applied",source:"human",appliedPlanId:plan.id,planJson:JSON.stringify({name:input.name,description:input.description,goalType:input.goalType,weeks:input.weeks,days:input.days}),explanationJson:JSON.stringify(["مربی برنامهٔ بررسی‌شده را ثبت کرده است."])}});
    await tx.notification.create({ data: { userId: athlete.id, type: "system", title: "برنامه جدید از مربی", body: `برنامه «${plan.name}» از امروز فعال است. برنامه و توضیحات مربی را بررسی کن.` } });
    return plan;
  }, { timeout: 30000, maxWait: 10000 });
}
