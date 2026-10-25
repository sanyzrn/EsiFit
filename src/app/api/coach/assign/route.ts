import { rateLimit } from "@/lib/http/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { db } from "@/lib/db";
import { addDaysISO, todayISO } from "@/lib/dates/jalali";
import { createPlanFromTemplate, PLAN_TEMPLATE_FA } from "@/features/workouts/data/plan-templates";

const bodySchema = z.object({
  athleteId: z.string().min(1),
  template: z.enum(["ppl", "upper_lower"]),
  note: z.string().max(300).optional(),
});

/** POST /api/coach/assign — assign a program template to a roster athlete. */
export async function POST(req: Request) {
  try {
    const session = await requireRole("coach");
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, code: "validation" }, { status: 400 });
    }
    const { athleteId, template, note } = parsed.data;

    const link = await db.coachClient.findUnique({
      where: { coachId_athleteId: { coachId: session.id, athleteId } },
    });
    if (!link || link.status !== "active") {
      return NextResponse.json(
        { ok: false, code: "authorization", message: "این ورزشکار در فهرست شما نیست." },
        { status: 403 },
      );
    }

    const athlete = await db.user.findUnique({ where: { id: athleteId }, select: { id: true, role: true, status: true, timezone: true } });
    if (!athlete || athlete.status !== "active" || athlete.role !== "member") {
      return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    }

    const rl = await rateLimit(`coach:assign:${athleteId}`, 10, 24 * 60 * 60 * 1000);
    if (!rl.ok) return NextResponse.json({ ok: false, code: "rate_limit", message: "سقف تغییر برنامهٔ این ورزشکار پر شده است. بعداً تلاش کنید.", retryAfterSeconds: rl.retryAfterSeconds }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } });

    // Coach-prescribed programs start tomorrow (matches UI copy).
    const startsOn = addDaysISO(todayISO(athlete.timezone), 1);
    const plan = await createPlanFromTemplate(athleteId, template, startsOn, undefined, athlete.timezone);

    // Only the assigned coach may update notes on an existing roster link.
    if (note != null && note !== "") {
      if (link) {
        if (note !== link.note) {
          await db.coachClient.update({ where: { id: link.id }, data: { note } });
        }
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
