import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { db } from "@/lib/db";
import { computeGoalProgress, GOAL_TYPES } from "@/lib/domain/goals";
import { currentValueForGoal } from "@/lib/goal-values";
import { todayISO } from "@/lib/dates/jalali";

/** GET /api/goals — all goals with live progress. */
export async function GET() {
  try {
    const session = await requireUser();
    const today = todayISO(session.timezone);
    const goals = await db.goal.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
    });

    const withProgress = await Promise.all(
      goals.map(async (g) => {
        const current = await currentValueForGoal(session.id, g, today);
        const progress = computeGoalProgress(g, current, today);
        // Auto-mark achieved goals.
        if (progress.achieved && g.status === "active") {
          await db.goal.update({ where: { id: g.id }, data: { status: "achieved" } });
          progress.statusFa = "هدف محقق شده — آفرین!";
        }
        return {
          id: g.id,
          type: g.type,
          title: g.title,
          unit: g.unit,
          startDate: g.startDate,
          targetDate: g.targetDate,
          status: progress.achieved && g.status === "active" ? "achieved" : g.status,
          startValue: g.startValue,
          targetValue: g.targetValue,
          currentValue: current,
          direction: progress.direction,
          percent: progress.percent,
          progress,
        };
      }),
    );

    return NextResponse.json({ ok: true, goals: withProgress });
  } catch (error) {
    return appErrorResponse(error);
  }
}

const createSchema = z.object({
  type: z.enum(GOAL_TYPES),
  title: z.string().max(80).optional(),
  targetValue: z.number().positive().finite(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  exerciseSlug: z.string().max(80).optional(), // strength goals scope
});

/** POST /api/goals — create a goal; startValue anchors to the live current value. */
export async function POST(req: Request) {
  try {
    const session = await requireUser();
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, code: "validation", message: "اطلاعات هدف کامل نیست." }, { status: 400 });
    }
    const { type, title, targetValue, targetDate, exerciseSlug } = parsed.data;

    const activeCount = await db.goal.count({ where: { userId: session.id, status: "active" } });
    if (activeCount >= 8) {
      return NextResponse.json(
        { ok: false, code: "quota", message: "حداکثر ۸ هدف فعال می‌توانید داشته باشید." },
        { status: 402 },
      );
    }

    const today = todayISO(session.timezone);
    if (new Date(`${targetDate}T00:00:00Z`) <= new Date(`${today}T00:00:00Z`)) {
      return NextResponse.json(
        { ok: false, code: "validation", message: "تاریخ هدف باید در آینده باشد." },
        { status: 400 },
      );
    }

    // Anchor startValue from live data so progress is honest from day one.
    const startValue = await currentValueForGoal(session.id, { id: "new", type, startValue: 0 }, today);
    if (!Number.isFinite(startValue)) {
      return NextResponse.json(
        { ok: false, code: "validation", message: "هنوز داده‌ای برای نقطه شروع وجود ندارد." },
        { status: 400 },
      );
    }

    // Unit per type.
    const unit =
      type === "weight" ? "kg" :
      type === "workout_frequency" ? "session" :
      type === "strength" ? "kg" :
      type === "volume" ? "kg" : "day";

    const goal = await db.goal.create({
      data: {
        userId: session.id,
        type,
        title: title?.trim() || "",
        startValue,
        targetValue,
        unit,
        metaJson: exerciseSlug ? JSON.stringify({ exerciseSlug }) : "{}",
        startDate: today,
        targetDate,
        status: "active",
      },
    });

    return NextResponse.json({ ok: true, goal: { id: goal.id, startValue } });
  } catch (error) {
    return appErrorResponse(error);
  }
}
