import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { db } from "@/lib/db";

const bodySchema = z.object({
  sessionId: z.string().min(1),
  exerciseId: z.string().min(1),
  targetExerciseId: z.string().min(1),
  reason: z.enum(["equipment", "pain_limitation", "preference", "difficulty", "unavailable", "other"]),
});

/**
 * POST /api/workouts/swap — replace an exercise inside an ACTIVE session.
 * - Blocked once any set is logged for the source exercise (no silent data loss).
 * - Creates the replacement ExerciseLog on demand (plan sessions may not have
 *   a log row before the first set).
 * - Persists an ExerciseSwap row for the coaching feedback loop.
 */
export async function POST(req: Request) {
  try {
    const sessionUser = await requireUser();
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, code: "validation" }, { status: 400 });
    }
    const { sessionId, exerciseId, targetExerciseId, reason } = parsed.data;

    const session = await db.workoutSession.findUnique({
      where: { id: sessionId },
      include: { exerciseLogs: { include: { _count: { select: { sets: true } } } } },
    });
    if (!session || session.userId !== sessionUser.id) {
      return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    }
    if (session.status !== "active" && session.status !== "paused") {
      return NextResponse.json(
        { ok: false, code: "conflict", message: "جایگزینی فقط در جلسه فعال ممکن است." },
        { status: 409 },
      );
    }

    const target = await db.exercise.findUnique({ where: { id: targetExerciseId } });
    if (!target) {
      return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    }

    const existingLog = session.exerciseLogs.find((l) => l.exerciseId === exerciseId);
    if (existingLog && existingLog._count.sets > 0) {
      return NextResponse.json(
        { ok: false, code: "conflict", message: "برای این حرکت ست ثبت شده — جایگزینی ممکن نیست." },
        { status: 409 },
      );
    }

    // Swap (or create) the log row.
    const log = existingLog
      ? await db.exerciseLog.update({ where: { id: existingLog.id }, data: { exerciseId: target.id } })
      : await db.exerciseLog.create({
          data: {
            sessionId,
            exerciseId: target.id,
            orderIndex: session.exerciseLogs.length,
          },
        });

    await db.exerciseSwap.create({
      data: {
        userId: sessionUser.id,
        sourceExerciseId: exerciseId,
        replacementExerciseId: target.id,
        reason,
        workoutSessionId: sessionId,
      },
    });

    // Update a paused/active local name only if it referenced the old exercise.
    return NextResponse.json({
      ok: true,
      log: {
        id: log.id,
        exerciseId: log.exerciseId,
        name: target.nameFa,
        slug: target.slug,
        targetSets: 3,
        targetRepsMin: 8,
        targetRepsMax: 12,
        targetRpe: 7.5,
        restSeconds: 90,
        note: "",
      },
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
