import { todayISO, isValidISODate } from "@/lib/dates/jalali";
import { computeGoalProgress } from "@/lib/domain/goals";
import { currentValueForGoal } from "@/lib/goal-values";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMember } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { db } from "@/lib/db";

const patchSchema = z.object({
  status: z.enum(["active", "achieved", "archived"]).optional(),
  title: z.string().max(80).optional(),
  targetValue: z.number().positive().finite().optional(),
  targetDate: z.string().refine(isValidISODate, "تاریخ معتبر نیست.").optional(),
});

/** PATCH /api/goals/[id] — update own goal (title/target/status). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireMember();
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, code: "validation" }, { status: 400 });
    }

    const goal = await db.goal.findUnique({ where: { id } });
    if (!goal || goal.userId !== session.id) {
      return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    }

    const today = todayISO(session.timezone);
    if (parsed.data.targetDate && parsed.data.targetDate <= today) {
      return NextResponse.json({ ok: false, code: "validation", message: "تاریخ هدف باید در آینده باشد." }, { status: 400 });
    }
    const changesTarget = parsed.data.targetValue != null;
    let status = parsed.data.status ?? goal.status;
    if (status !== "archived" && (changesTarget || parsed.data.status === "active")) {
      const current = await currentValueForGoal(session.id, goal, today);
      status = computeGoalProgress({ ...goal, targetValue: parsed.data.targetValue ?? goal.targetValue }, current, today).achieved ? "achieved" : "active";
    }

    const updated = await db.goal.update({
      where: { id },
      data: {
        status,
        ...(parsed.data.title != null ? { title: parsed.data.title } : {}),
        ...(parsed.data.targetValue != null ? { targetValue: parsed.data.targetValue } : {}),
        ...(parsed.data.targetDate ? { targetDate: parsed.data.targetDate } : {}),
      },
    });
    return NextResponse.json({ ok: true, goal: { id: updated.id, status: updated.status } });
  } catch (error) {
    return appErrorResponse(error);
  }
}

/** DELETE /api/goals/[id] — remove own goal. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireMember();
    const { id } = await params;
    const goal = await db.goal.findUnique({ where: { id } });
    if (!goal || goal.userId !== session.id) {
      return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    }
    await db.goal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return appErrorResponse(error);
  }
}
