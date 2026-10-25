import { withSessionLock } from "@/lib/workout/session-lock";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMember } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { defaultPrescription } from "@/lib/workout/prescription";

const bodySchema = z.object({ exerciseId: z.string().min(1) });

/**
 * POST /api/workouts/sessions/[id]/add-exercise — append an exercise to an
 * ACTIVE (free) session. Prescription is plan-aware when possible.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await requireMember();
    const { id } = await params;
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, code: "validation" }, { status: 400 });
    }

    return await withSessionLock(id, async tx => {
      const session = await tx.workoutSession.findUnique({
        where: { id },
        include: { exerciseLogs: { select: { id: true } } },
      });
      if (!session || session.userId !== sessionUser.id) {
        return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
      }
      if (session.status !== "active" && session.status !== "paused") {
        return NextResponse.json({ ok: false, code: "conflict", message: "جلسه فعال نیست." }, { status: 409 });
      }

      const exercise = await tx.exercise.findUnique({ where: { id: parsed.data.exerciseId } });
      if (!exercise) {
        return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
      }

      const dup = await tx.exerciseLog.findFirst({
        where: { sessionId: id, exerciseId: exercise.id },
        select: { id: true },
      });
      if (dup) {
        return NextResponse.json(
          { ok: false, code: "conflict", message: "این حرکت قبلاً به جلسه اضافه شده است." },
          { status: 409 },
        );
      }

      let prescription = defaultPrescription(exercise);
      if (session.planDayId) {
        const planned = await tx.plannedExercise.findFirst({
          where: { planDayId: session.planDayId, exerciseId: exercise.id },
        });
        if (planned) {
          prescription = {
            targetSets: planned.targetSets,
            targetRepsMin: planned.targetRepsMin,
            targetRepsMax: planned.targetRepsMax,
            targetRpe: planned.targetRpe,
            restSeconds: planned.restSeconds,
            note: planned.note,
          };
        }
      }

      await tx.exerciseLog.create({
        data: { sessionId: id, exerciseId: exercise.id, orderIndex: session.exerciseLogs.length },
      });

      return NextResponse.json({
        ok: true,
        exercise: {
          exerciseId: exercise.id,
          name: exercise.nameFa,
          slug: exercise.slug,
          instructions: exercise.instructionsFa,
          equipment: exercise.equipment,
          ...prescription,
          sets: [],
        },
      });
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
