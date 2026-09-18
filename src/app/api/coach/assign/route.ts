import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { db } from "@/lib/db";
import { createPlanFromTemplate, PLAN_TEMPLATE_FA } from "@/features/workouts/data/plan-templates";

const bodySchema = z.object({
  athleteId: z.string().min(1),
  template: z.enum(["ppl", "upper_lower"]),
  note: z.string().max(300).optional(),
});

/** POST /api/coach/assign — assign a program template to a roster athlete. */
export async function POST(req: Request) {
  try {
    const session = await requireRole("coach_or_admin");
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, code: "validation" }, { status: 400 });
    }
    const { athleteId, template, note } = parsed.data;

    const link = await db.coachClient.findUnique({
      where: { coachId_athleteId: { coachId: session.id, athleteId } },
    });
    const isSupervisor = session.role === "admin";
    if (!link && !isSupervisor) {
      return NextResponse.json(
        { ok: false, code: "authorization", message: "این ورزشکار در فهرست شما نیست." },
        { status: 403 },
      );
    }

    const athlete = await db.user.findUnique({ where: { id: athleteId }, select: { id: true, status: true } });
    if (!athlete || athlete.status !== "active") {
      return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    }

    // Coach-prescribed programs start tomorrow (matches UI copy).
    const startsOn = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const plan = await createPlanFromTemplate(athleteId, template, startsOn);

    // Persist/refresh the coaching note — create the roster link when admin assigns.
    if (note != null && note !== "") {
      if (link) {
        if (note !== link.note) {
          await db.coachClient.update({ where: { id: link.id }, data: { note } });
        }
      } else {
        await db.coachClient.upsert({
          where: { coachId_athleteId: { coachId: session.id, athleteId } },
          create: { coachId: session.id, athleteId, note, status: "active" },
          update: { note },
        });
      }
    }

    // Notify the athlete in-app.
    await db.notification.create({
      data: {
        userId: athleteId,
        type: "system",
        title: "برنامه جدید از مربی",
        body: `مربی شما برنامه «${PLAN_TEMPLATE_FA[template]}» را برایتان فعال کرد. اجرا از فردا آغاز می‌شود.`,
      },
    });

    return NextResponse.json({ ok: true, planId: plan.id, planName: plan.name });
  } catch (error) {
    return appErrorResponse(error);
  }
}
