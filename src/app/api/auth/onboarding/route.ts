import { readJson } from "@/lib/http/read-json";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { z } from "zod";
import { todayISO, toJalali } from "@/lib/dates/jalali";
import { computeMacroTargets, ageEstimateFromBirthYear } from "@/lib/domain/body-math";
import { serializeAvailableEquipment } from "@/lib/workout/equipment";
import { reviewReasons } from "@/lib/ai/planning/rules";

const schema = z.object({
  displayName: z.string().min(2).max(40),
  birthYear: z.number().int().min(1300).max(toJalali(new Date()).jy-10),
  sexAtBirth: z.enum(["female", "male", "intersex", "undisclosed"]),
  heightCm: z.number().min(100).max(230),
  weightKg: z.number().min(30).max(300),
  primaryGoal: z.enum(["lose_weight", "build_muscle", "endurance", "health", "recomp"]),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced"]),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  unitSystem: z.enum(["metric", "imperial"]).default("metric"),
  weeklyWorkoutTarget: z.number().int().min(2).max(6).default(3),
  workoutMinutes: z.number().int().min(20).max(90).default(45),
  medicalReviewRequired: z.boolean().default(false),
  healthNotes: z.string().trim().max(500).default(""),
  injury: z.object({bodyRegion:z.enum(["lower_back","shoulder","knee","elbow","wrist","hip","ankle","neck","groin","ribs","other"]),severity:z.number().int().min(1).max(10),note:z.string().max(280).default("")}).optional(),
  availableEquipment: z.array(z.string()).max(20).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireMember();
    const parsed = schema.parse(await readJson(req));
    const { displayName, unitSystem, weightKg, availableEquipment, injury, ...profileFields } = parsed;

    const needsReview = reviewReasons({age:ageEstimateFromBirthYear(profileFields.birthYear),heightCm:profileFields.heightCm,weightKg,goal:profileFields.primaryGoal,level:profileFields.experienceLevel,medicalReviewRequired:profileFields.medicalReviewRequired,healthNotes:profileFields.healthNotes,pains:injury?[injury]:[]}).length>0;
    const macros = needsReview ? null : computeMacroTargets({
      sex: profileFields.sexAtBirth,
      birthYear: profileFields.birthYear,
      heightCm: profileFields.heightCm,
      weightKg,
      activityLevel: profileFields.activityLevel,
      goal: profileFields.primaryGoal,
    });

    const today = todayISO(session.timezone);
    const equipmentJson = serializeAvailableEquipment(availableEquipment ?? []);

    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${session.id} FOR UPDATE`;
      await Promise.all([
      tx.user.update({
        where: { id: session.id },
        data: { displayName, unitSystem },
      }),
      tx.userProfile.upsert({
        where: { userId: session.id },
        create: {
          userId: session.id,
          ...profileFields,
          availableEquipment: equipmentJson,
          dailyCalorieTarget: macros?.calories ?? null,
          dailyProteinTarget: macros?.proteinG ?? null,
          dailyCarbTarget: macros?.carbsG ?? null,
          dailyFatTarget: macros?.fatG ?? null,
          dailyWaterTargetMl: Math.round((weightKg * 33) / 100) * 100,
          onboardedAt: new Date(),
        },
        update: {
          ...profileFields,
          availableEquipment: equipmentJson,
          dailyCalorieTarget: macros?.calories ?? null,
          dailyProteinTarget: macros?.proteinG ?? null,
          dailyCarbTarget: macros?.carbsG ?? null,
          dailyFatTarget: macros?.fatG ?? null,
          dailyWaterTargetMl: Math.round((weightKg * 33) / 100) * 100,
          onboardedAt: new Date(),
        },
      }),
      tx.bodyMeasurement.upsert({
        where: { userId_measuredOn: { userId: session.id, measuredOn: today } },
        create: { userId: session.id, measuredOn: today, weightKg },
        update: { weightKg },
      }),
      ]);
      if(injury){
        const previous=await tx.painReport.findFirst({where:{userId:session.id,bodyRegion:injury.bodyRegion,reportedOn:today,status:{in:["active","improving"]}}});
        if(previous)await tx.painReport.update({where:{id:previous.id},data:{severity:injury.severity,note:injury.note}});
        else await tx.painReport.create({data:{userId:session.id,reportedOn:today,bodyRegion:injury.bodyRegion,severity:injury.severity,note:injury.note}});
      }
    });
    // Profile capture never silently replaces an existing program. The separate
    // planner builds a reviewed draft after registration, including offline fallback.

    return NextResponse.json({ ok: true, macros, needsReview });
  } catch (error) {
    return appErrorResponse(error);
  }
}
