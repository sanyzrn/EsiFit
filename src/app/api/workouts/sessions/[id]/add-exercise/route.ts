import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { db } from "@/lib/db";

const bodySchema = z.object({ exerciseId: z.string().min(1) });

/**
 * POST /api/workouts/sessions/[id]/add-exercise — append an exercise to an
 * ACTIVE (free) session. This is what makes a free session usable: users add
 * movements from the library mid-workout.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await requireUser();
    const { id } = await params;
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, code: "validation" }, { status: 400 });
    }

    const session = await db.workoutSession.findUnique({
      where: { id },
      include: { exerciseLogs: { select: { id: true } } },
    });
    if (!session || session.userId !== sessionUser.id) {
      return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    }
    if (session.status !== "active" && session.status !== "paused") {
      return NextResponse.json({ ok: false, code: "conflict", message: "جلسه فعال نیست." }, { status: 409 });
    }

    const exercise = await db.exercise.findUnique({ where: { id: parsed.data.exerciseId } });
    if (!exercise) {
      return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    }

    // Duplicate guard — same exercise twice in one session is almost always a mistake.
    const dup = await db.exerciseLog.findFirst({
      where: { sessionId: id, exerciseId: exercise.id },
      select: { id: true },
    });
    if (dup) {
      return NextResponse.json(
        { ok: false, code: "conflict", message: "این حرکت قبلاً به جلسه اضافه شده است." },
        { status: 409 },
      );
    }

    await db.exerciseLog.create({
      data: { sessionId: id, exerciseId: exercise.id, orderIndex: session.exerciseLogs.length },
    });

    return NextResponse.json({
      ok: true,
      exercise: {
        exerciseId: exercise.id,
        name: exercise.nameFa,
        slug: exercise.slug,
        targetSets: 3,
        targetRepsMin: 8,
        targetRepsMax: 12,
        targetRpe: 7.5,
        restSeconds: 90,
        note: "",
        sets: [],
      },
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
