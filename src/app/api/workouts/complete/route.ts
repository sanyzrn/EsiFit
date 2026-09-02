import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { appErrorResponse } from "@/lib/errors/respond";
import { z } from "zod";
import { sessionVolume, oneRepMax } from "@/lib/domain/body-math";
import { awardXp, evaluateAfterWorkout } from "@/lib/domain/gamification-engine";

const schema = z.object({
  sessionId: z.string(),
  durationSeconds: z.number().int().min(0).max(6 * 3600).optional(),
  note: z.string().max(500).optional(),
});

/** Complete a workout session: volume, PR detection, XP, badges. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = schema.parse(await req.json());

    const session = await db.workoutSession.findUnique({
      where: { id: body.sessionId },
      include: {
        exerciseLogs: { include: { exercise: true, sets: true } },
      },
    });
    if (!session || session.userId !== user.id) {
      return NextResponse.json({ ok: false, code: "not_found", message: "جلسه تمرین یافت نشد." }, { status: 404 });
    }
    if (session.status === "completed") {
      return NextResponse.json({ ok: true, alreadyCompleted: true });
    }

    const allSets = session.exerciseLogs.flatMap((l) => l.sets);
    const volume = sessionVolume(allSets);
    // The client reports elapsed time in SECONDS; the wall-clock fallback is in
    // milliseconds. Normalize both to seconds before persisting.
    const elapsedSeconds =
      body.durationSeconds ??
      Math.round(((session.endedAt ?? new Date()).getTime() - session.startedAt.getTime()) / 1000);
    const durationSeconds = Math.max(60, elapsedSeconds);

    await db.workoutSession.update({
      where: { id: session.id },
      data: {
        status: "completed",
        endedAt: session.endedAt ?? new Date(),
        durationSeconds,
        totalVolumeKg: volume,
        syncStatus: "synced",
        note: body.note ?? session.note,
      },
    });

    // PR detection per exercise (best set by estimated 1RM)
    const prResults: Array<{ exerciseName: string; value: number; unit: string }> = [];
    for (const log of session.exerciseLogs) {
      const best = log.sets
        .filter((s) => s.weightKg != null && s.reps != null && !s.isWarmup)
        .map((s) => ({ set: s, orm: oneRepMax(s.weightKg!, s.reps!).recommended }))
        .sort((a, b) => b.orm - a.orm)[0];
      if (!best) continue;

      const prev = await db.personalRecord.findFirst({
        where: { userId: user.id, exerciseId: log.exerciseId, recordType: "weight", isCurrent: true },
      });
      if (!prev || best.orm > prev.value + 0.01) {
        if (prev) {
          await db.personalRecord.update({ where: { id: prev.id }, data: { isCurrent: false } });
        }
        await db.personalRecord.create({
          data: {
            userId: user.id, exerciseId: log.exerciseId, recordType: "weight",
            value: Math.round(best.orm * 10) / 10, unit: "kg",
            workoutSessionId: session.id, achievedAt: new Date(), isCurrent: true,
          },
        });
        await db.setLog.update({ where: { id: best.set.id }, data: { isPr: true } });
        prResults.push({ exerciseName: log.exercise.nameFa, value: Math.round(best.orm * 10) / 10, unit: "kg" });
      }
    }

    // XP + badges (idempotent)
    const xpResult = await awardXp({ userId: user.id, amount: 70, sourceType: "workout", sourceId: session.id });
    const newBadges = await evaluateAfterWorkout(user.id, session.id);

    return NextResponse.json({
      ok: true,
      summary: {
        volume: Math.round(volume),
        durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
        setCount: allSets.length,
        prs: prResults,
        xpAwarded: xpResult.awarded ? 70 : 0,
        newBadges,
      },
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
