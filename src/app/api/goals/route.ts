import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMember } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { db } from "@/lib/db";
import { computeGoalProgress, GOAL_TYPES, unitForGoalType } from "@/lib/domain/goals";
import { currentValueForGoal } from "@/lib/goal-values";
import { todayISO, isValidISODate } from "@/lib/dates/jalali";
import { rateLimit } from "@/lib/http/rate-limit";

/** GET /api/goals — all goals with live progress. */
export async function GET() {
  try {
    const session = await requireMember();
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
  targetDate: z.string().refine(isValidISODate, "تاریخ معتبر نیست."),
  exerciseSlug: z.string().max(80).optional(), // strength goals scope
});

/** POST /api/goals — create a goal; startValue anchors to the live current value. */
export async function POST(req: Request) {
  try {
    const session = await requireMember();
    const rl = await rateLimit(`goals:create:${session.id}`, 20, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, code: "rate_limit", message: "اهداف زیادی ساخته‌اید. کمی بعد تلاش کنید.", retryAfterSeconds: rl.retryAfterSeconds },
        { status: 429 },
      );
    }
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, code: "validation", message: "اطلاعات هدف کامل نیست." }, { status: 400 });
    }
    const { type, title, targetValue, targetDate, exerciseSlug } = parsed.data;

    return await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('esifit-goals'), hashtext(${session.id}))`;
      const activeCount = await tx.goal.count({ where: { userId: session.id, status: "active" } });
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
      // Weight/strength goals without measurements/PRs would otherwise anchor at 0.
      if (type === "weight") {
        const hasWeight = await tx.bodyMeasurement.count({
          where: { userId: session.id, weightKg: { not: null } },
        });
        if (hasWeight === 0) {
          return NextResponse.json(
            { ok: false, code: "validation", message: "برای هدف وزن، ابتدا یک اندازه‌گیری وزن ثبت کنید." },
            { status: 400 },
          );
        }
      }
      if (type === "strength") {
        const hasPr = await tx.personalRecord.count({
          where: { userId: session.id, isCurrent: true, recordType: "weight", ...(exerciseSlug ? { exercise: { slug: exerciseSlug } } : {}) },
        });
        if (hasPr === 0) {
          return NextResponse.json(
            { ok: false, code: "validation", message: "برای هدف قدرت، ابتدا باید رکوردی ثبت شده باشد." },
            { status: 400 },
          );
        }
      }

      const startValue = await currentValueForGoal(session.id, { id: "new", type, startValue: 0, metaJson: exerciseSlug ? JSON.stringify({ exerciseSlug }) : "{}" }, today);
      if (!Number.isFinite(startValue) || (type === "weight" && startValue <= 0)) {
        return NextResponse.json(
          { ok: false, code: "validation", message: "هنوز داده‌ای برای نقطه شروع وجود ندارد." },
          { status: 400 },
        );
      }

      if ((type === "weight" && targetValue === startValue) || (type !== "weight" && targetValue <= startValue)) {
        return NextResponse.json({ ok: false, code: "validation", message: "این هدف هم‌اکنون محقق است؛ هدف تازه‌ای انتخاب کنید." }, { status: 400 });
      }
      const activeGoals = await tx.goal.findMany({ where: { userId: session.id, type, status: "active", targetValue } });
      const duplicate = activeGoals.some(g => {
        try { return (JSON.parse(g.metaJson).exerciseSlug ?? null) === (exerciseSlug ?? null); }
        catch { return !exerciseSlug; }
      });
      if (duplicate) return NextResponse.json({ ok: false, code: "conflict", message: "هدف فعالی با همین مقدار و محدوده دارید." }, { status: 409 });

      // Unit per type (canonical keys shared with GOAL_UNIT_FA display).
      const unit = unitForGoalType(type);

      const goal = await tx.goal.create({
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
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
