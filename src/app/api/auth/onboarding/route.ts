import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { z } from "zod";
import { computeMacroTargets } from "@/lib/domain/body-math";
import { serializeAvailableEquipment } from "@/lib/workout/equipment";
import { equipmentSetFromList } from "@/lib/workout/equipment";
import { createDefaultPlanForUser } from "@/features/workouts/data/plan-templates";

const schema = z.object({
  displayName: z.string().min(2).max(40),
  birthYear: z.number().int().min(1300).max(1420),
  sexAtBirth: z.enum(["female", "male", "intersex", "undisclosed"]),
  heightCm: z.number().min(100).max(230),
  weightKg: z.number().min(30).max(300),
  primaryGoal: z.enum(["lose_weight", "build_muscle", "endurance", "health", "recomp"]),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced"]),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  unitSystem: z.enum(["metric", "imperial"]).default("metric"),
  availableEquipment: z.array(z.string()).max(20).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const parsed = schema.parse(await req.json());
    const { displayName, unitSystem, weightKg, availableEquipment, ...profileFields } = parsed;

    const macros = computeMacroTargets({
      sex: profileFields.sexAtBirth,
      birthYear: profileFields.birthYear,
      heightCm: profileFields.heightCm,
      weightKg,
      activityLevel: profileFields.activityLevel,
      goal: profileFields.primaryGoal,
    });

    const today = new Date().toISOString().slice(0, 10);
    const equipmentJson = serializeAvailableEquipment(availableEquipment ?? []);

    await db.$transaction([
      db.user.update({
        where: { id: session.id },
        data: { displayName, unitSystem },
      }),
      db.userProfile.upsert({
        where: { userId: session.id },
        create: {
          userId: session.id,
          ...profileFields,
          availableEquipment: equipmentJson,
          dailyCalorieTarget: macros.calories,
          dailyProteinTarget: macros.proteinG,
          dailyCarbTarget: macros.carbsG,
          dailyFatTarget: macros.fatG,
          dailyWaterTargetMl: Math.round((weightKg * 33) / 100) * 100,
          onboardedAt: new Date(),
        },
        update: {
          ...profileFields,
          availableEquipment: equipmentJson,
          dailyCalorieTarget: macros.calories,
          dailyProteinTarget: macros.proteinG,
          dailyCarbTarget: macros.carbsG,
          dailyFatTarget: macros.fatG,
          dailyWaterTargetMl: Math.round((weightKg * 33) / 100) * 100,
          onboardedAt: new Date(),
        },
      }),
      db.bodyMeasurement.upsert({
        where: { userId_measuredOn: { userId: session.id, measuredOn: today } },
        create: { userId: session.id, measuredOn: today, weightKg },
        update: { weightKg },
      }),
    ]);

    // Rebuild the starter plan so equipment substitutions apply immediately.
    await createDefaultPlanForUser(session.id, equipmentSetFromList(availableEquipment ?? []));

    return NextResponse.json({ ok: true, macros });
  } catch (error) {
    return appErrorResponse(error);
  }
}
