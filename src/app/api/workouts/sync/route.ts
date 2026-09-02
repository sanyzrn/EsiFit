import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { toAppError } from "@/lib/errors/app-error";
import { appErrorResponse } from "@/lib/errors/respond";
import { z } from "zod";

/**
 * Idempotent offline sync for live-workout writes.
 * Client posts a batch of operations with stable clientIds; re-sending the
 * same batch is a no-op thanks to unique clientId constraints.
 * last-write-wins for workout logs (documented conflict behavior).
 */

const setOp = z.object({
  clientId: z.string().min(6).max(64),
  sessionId: z.string(),
  exerciseId: z.string(),
  orderIndex: z.number().int().min(0).max(50),
  setNumber: z.number().int().min(1).max(30),
  weightKg: z.number().min(0).max(600).nullable().optional(),
  reps: z.number().int().min(0).max(200).nullable().optional(),
  rpe: z.number().min(1).max(10).nullable().optional(),
  durationSeconds: z.number().int().min(0).max(7200).nullable().optional(),
  completedAt: z.string().datetime().optional(),
});

const bodySchema = z.object({ sets: z.array(setOp).max(200) });

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      console.error("[sync] validation failed:", JSON.stringify(parsed.error.issues?.slice(0, 3)));
      throw toAppError(parsed.error);
    }
    const body = parsed.data;

    let synced = 0;
    let conflicts = 0;
    for (const op of body.sets) {
      // Ownership check: session must belong to user
      const session = await db.workoutSession.findUnique({
        where: { id: op.sessionId },
        select: { userId: true },
      });
      if (!session || session.userId !== user.id) {
        conflicts++;
        continue;
      }

      // Ensure the exercise log exists (idempotent by session+exercise+order)
      let log = await db.exerciseLog.findFirst({
        where: { sessionId: op.sessionId, exerciseId: op.exerciseId, orderIndex: op.orderIndex },
      });
      if (!log) {
        log = await db.exerciseLog.create({
          data: { sessionId: op.sessionId, exerciseId: op.exerciseId, orderIndex: op.orderIndex },
        });
      }

      const existing = await db.setLog.findUnique({ where: { clientId: op.clientId } }).catch(() => null);
      if (existing) {
        synced++;
        continue;
      }

      await db.setLog.create({
        data: {
          exerciseLogId: log.id,
          setNumber: op.setNumber,
          weightKg: op.weightKg ?? null,
          reps: op.reps ?? null,
          rpe: op.rpe ?? null,
          durationSeconds: op.durationSeconds ?? null,
          completedAt: op.completedAt ? new Date(op.completedAt) : new Date(),
          clientId: op.clientId,
        },
      }).catch(() => {
        conflicts++;
        return null;
      });
      synced++;
    }

    return NextResponse.json({ ok: true, synced, conflicts });
  } catch (error) {
    return appErrorResponse(error);
  }
}
