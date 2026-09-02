import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { appErrorResponse } from "@/lib/errors/respond";
import { z } from "zod";
import { getTodayPlanDay } from "@/features/workouts/data/plan-templates";

const startSchema = z.object({
  planDayId: z.string().optional(),
  name: z.string().max(80).optional(),
});

export type LiveSessionExercise = {
  exerciseId: string;
  name: string;
  slug: string;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetRpe: number;
  restSeconds: number;
  note: string;
};

/** Shape the planned exercise contract for a resumed session (plan-based or free-form). */
async function shapeExercisesFor(session: {
  id: string;
  planDayId: string | null;
}): Promise<LiveSessionExercise[]> {
  if (session.planDayId) {
    const day = await db.workoutPlanDay.findUnique({
      where: { id: session.planDayId },
      include: { exercises: { include: { exercise: true }, orderBy: { orderIndex: "asc" } } },
    });
    if (day) {
      return day.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        name: e.exercise.nameFa,
        slug: e.exercise.slug,
        targetSets: e.targetSets,
        targetRepsMin: e.targetRepsMin,
        targetRepsMax: e.targetRepsMax,
        targetRpe: e.targetRpe,
        restSeconds: e.restSeconds,
        note: e.note,
      }));
    }
  }
  // Free session: derive from logged exercises so the HUD stays usable.
  const logs = await db.exerciseLog.findMany({
    where: { sessionId: session.id },
    include: { exercise: true },
    orderBy: { orderIndex: "asc" },
  });
  return logs.map((l) => ({
    exerciseId: l.exerciseId,
    name: l.exercise.nameFa,
    slug: l.exercise.slug,
    targetSets: 3,
    targetRepsMin: 8,
    targetRepsMax: 12,
    targetRpe: 7.5,
    restSeconds: 90,
    note: "",
  }));
}

/** Start (or resume) a workout session. */
export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const body = startSchema.parse(await req.json().catch(() => ({})));

    const existing = await db.workoutSession.findFirst({
      where: { userId: session.id, status: { in: ["active", "paused"] } },
      orderBy: { startedAt: "desc" },
      include: {
        exerciseLogs: { include: { exercise: true, sets: true }, orderBy: { orderIndex: "asc" } },
      },
    });
    if (existing) {
      return NextResponse.json({ ok: true, session: { ...existing, exercises: await shapeExercisesFor(existing) }, resumed: true });
    }

    let planDayId: string | null = null;
    let name = body.name ?? "تمرین آزاد";
    let exercises: LiveSessionExercise[] = [];

    if (body.planDayId) {
      const day = await db.workoutPlanDay.findUnique({
        where: { id: body.planDayId },
        include: {
          exercises: { include: { exercise: true }, orderBy: { orderIndex: "asc" } },
          plan: true,
        },
      });
      if (!day || day.plan.userId !== session.id) {
        return NextResponse.json({ ok: false, code: "not_found", message: "برنامه یافت نشد." }, { status: 404 });
      }
      planDayId = day.id;
      name = day.name;
      exercises = day.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        name: e.exercise.nameFa,
        slug: e.exercise.slug,
        targetSets: e.targetSets,
        targetRepsMin: e.targetRepsMin,
        targetRepsMax: e.targetRepsMax,
        targetRpe: e.targetRpe,
        restSeconds: e.restSeconds,
        note: e.note,
      }));
    } else {
      const today = await getTodayPlanDay(session.id);
      // Rest days keep their active-recovery entries (walk/mobility) so the
      // live HUD is never an empty dead-end.
      if (today) {
        planDayId = today.id;
        name = today.name;
        exercises = today.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          name: e.exercise.nameFa,
          slug: e.exercise.slug,
          targetSets: e.targetSets,
          targetRepsMin: e.targetRepsMin,
          targetRepsMax: e.targetRepsMax,
          targetRpe: e.targetRpe,
          restSeconds: e.restSeconds,
          note: e.note,
        }));
      }
    }

    const created = await db.workoutSession.create({
      data: {
        userId: session.id,
        planDayId,
        name,
        startedAt: new Date(),
        status: "active",
        syncStatus: "synced",
      },
      include: { exerciseLogs: { include: { exercise: true, sets: true } } },
    });

    return NextResponse.json({ ok: true, session: { ...created, exercises }, resumed: false });
  } catch (error) {
    return appErrorResponse(error);
  }
}

/** Get current active session. */
export async function GET() {
  try {
    const session = await requireUser();
    const active = await db.workoutSession.findFirst({
      where: { userId: session.id, status: { in: ["active", "paused"] } },
      orderBy: { startedAt: "desc" },
      include: {
        exerciseLogs: {
          include: { exercise: true, sets: { orderBy: { setNumber: "asc" } } },
          orderBy: { orderIndex: "asc" },
        },
      },
    });
    if (!active) return NextResponse.json({ ok: true, session: null });
    return NextResponse.json({ ok: true, session: { ...active, exercises: await shapeExercisesFor(active) } });
  } catch (error) {
    return appErrorResponse(error);
  }
}
