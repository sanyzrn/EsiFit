import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { createPlanFromTemplate } from "@/features/workouts/data/plan-templates";
import { getUserEquipmentSet } from "@/lib/workout/catalog";
import { db } from "@/lib/db";

const schema = z.object({
  template: z.enum(["ppl", "upper_lower"]).default("ppl"),
});

/** POST /api/workouts/plan/regenerate — rebuild the 4-week plan from profile equipment. */
export async function POST(req: Request) {
  try {
    const session = await requireUser();
    const body = schema.parse(await req.json().catch(() => ({})));
    const equipment = await getUserEquipmentSet(session.id);
    const plan = await createPlanFromTemplate(session.id, body.template, undefined, equipment);
    const dayCount = await db.workoutPlanDay.count({ where: { planId: plan.id } });
    return NextResponse.json({
      ok: true,
      planId: plan.id,
      planName: plan.name,
      weeks: plan.weeks,
      dayCount,
      message: `برنامه ${plan.weeks} هفته‌ای با وسایل فعلی شما بازسازی شد.`,
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
