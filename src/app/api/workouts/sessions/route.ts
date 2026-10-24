import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { appErrorResponse } from "@/lib/errors/respond";
import { z } from "zod";
import { attachHistory, type ExerciseHistory } from "@/lib/workout/history";
import { getTodayPlanDay } from "@/features/workouts/data/plan-templates";
import { formatWorkoutDayTitle } from "@/lib/workout/plan-titles";

const startSchema = z.object({
  planDayId: z.string().optional(),
  name: z.string().max(80).optional(),
  clientId: z.string().min(6).max(64).optional(),
  /** Resume a specific owned session when the client navigates with ?session=. */
  sessionId: z.string().optional(),
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
  /** Present on live payloads: equipment drives increments/plates; history drives pre-fill. */
  equipment?: string;
  instructions?: string;
  history?: ExerciseHistory;
};

/** Shape the planned exercise contract for a resumed session (plan-based or free-form). */
async function shapeExercisesFor(
  session: { id: string; planDayId: string | null },
  user: { id: string; timezone: string },
): Promise<LiveSessionExercise[]> {
  return attachHistory(user.id, user.timezone, await shapeExercisesRaw(session), session.id);
}

async function shapeExercisesRaw(session: { id: string; planDayId: string | null }): Promise<LiveSessionExercise[]> {
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
        instructions: e.exercise.instructionsFa,
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
    instructions: l.exercise.instructionsFa,
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
    const session = await requireMember();
    const body = startSchema.parse(await req.json().catch(() => ({})));

    // Explicit resume: honor ?session= navigation from dashboard/workouts.
    if (body.sessionId) {
      const requested = await db.workoutSession.findFirst({
        where: {
          id: body.sessionId,
          userId: session.id,
          status: { in: ["active", "paused"] },
        },
        include: {
          exerciseLogs: { include: { exercise: true, sets: true }, orderBy: { orderIndex: "asc" } },
        },
      });
      if (requested) {
        return NextResponse.json({
          ok: true,
          session: { ...requested, name: formatWorkoutDayTitle(requested.name), exercises: await shapeExercisesFor(requested, session) },
          resumed: true,
        });
      }
    }

    const existing = await db.workoutSession.findFirst({
      where: { userId: session.id, status: { in: ["active", "paused"] } },
      orderBy: { startedAt: "desc" },
      include: {
        exerciseLogs: { include: { exercise: true, sets: true }, orderBy: { orderIndex: "asc" } },
      },
    });
    if (existing) {
      return NextResponse.json({ ok: true, session: { ...existing, name: formatWorkoutDayTitle(existing.name), exercises: await shapeExercisesFor(existing, session) }, resumed: true });
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
      name = formatWorkoutDayTitle(day.name);
      exercises = day.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        name: e.exercise.nameFa,
        slug: e.exercise.slug,
        instructions: e.exercise.instructionsFa,
        targetSets: e.targetSets,
        targetRepsMin: e.targetRepsMin,
        targetRepsMax: e.targetRepsMax,
        targetRpe: e.targetRpe,
        restSeconds: e.restSeconds,
        note: e.note,
      }));
    } else {
      const today = await getTodayPlanDay(session.id, session.timezone);
      // Rest days keep their active-recovery entries (walk/mobility) so the
      // live HUD is never an empty dead-end.
      if (today) {
        planDayId = today.id;
        name = formatWorkoutDayTitle(today.name);
        exercises = today.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          name: e.exercise.nameFa,
          slug: e.exercise.slug,
        instructions: e.exercise.instructionsFa,
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
        clientId: body.clientId ?? null,
      },
      include: { exerciseLogs: { include: { exercise: true, sets: true } } },
    });

    exercises = await attachHistory(session.id, session.timezone, exercises, created.id);
    return NextResponse.json({ ok: true, session: { ...created, exercises }, resumed: false });
  } catch (error) {
    return appErrorResponse(error);
  }
}

/** Get current active session. */
export async function GET() {
  try {
    const session = await requireMember();
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
    return NextResponse.json({ ok: true, session: { ...active, name: formatWorkoutDayTitle(active.name), exercises: await shapeExercisesFor(active, session) } });
  } catch (error) {
    return appErrorResponse(error);
  }
}

/** Cancel a never-started workout without recording an artificial zero-set workout or XP. */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireMember();
    const { sessionId } = z.object({ sessionId: z.string().min(1) }).parse(await req.json());
    const active = await db.workoutSession.findFirst({
      where: { id: sessionId, userId: user.id, status: { in: ["active", "paused"] } },
      select: {
        id: true,
        exerciseLogs: { select: { _count: { select: { sets: true } } } },
      },
    });
    if (!active) {
      return NextResponse.json({ ok: false, code: "not_found", message: "جلسه فعال پیدا نشد." }, { status: 404 });
    }
    if (active.exerciseLogs.some((log) => log._count.sets > 0)) {
      return NextResponse.json({
        ok: false, code: "session_has_sets",
        message: "این جلسه ست ثبت‌شده دارد؛ برای حفظ رکوردها، آن را از بخش پایان تمرین تمام کنید.",
      }, { status: 409 });
    }
    await db.workoutSession.update({
      where: { id: active.id },
      data: { status: "abandoned", endedAt: new Date() },
    });
    return NextResponse.json({ ok: true, canceled: true });
  } catch (error) {
    return appErrorResponse(error);
  }
}
