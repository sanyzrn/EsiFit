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
    let failed = 0;
    for (const op of body.sets) {
      // Ownership/validation failures are conflicts (terminal). Unexpected
      // errors are failed (retryable) so the offline queue never parks data
      // permanently on a transient DB blip.
      try {
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
          const exercise = await db.exercise.findUnique({ where: { id: op.exerciseId }, select: { id: true } });
          if (!exercise) {
            // Unknown exercise can never apply — terminal conflict.
            conflicts++;
            continue;
          }
          try {
            log = await db.exerciseLog.create({
              data: { sessionId: op.sessionId, exerciseId: op.exerciseId, orderIndex: op.orderIndex },
            });
          } catch {
            // Concurrent create race — re-fetch the winner.
            log = await db.exerciseLog.findUnique({
              where: { sessionId_exerciseId_orderIndex: { sessionId: op.sessionId, exerciseId: op.exerciseId, orderIndex: op.orderIndex } },
            });
            if (!log) {
              conflicts++;
              continue;
            }
          }
        }

        const existing = await db.setLog.findUnique({
          where: { userId_clientId: { userId: user.id, clientId: op.clientId } },
        });
        if (existing) {
          synced++;
          continue;
        }

        await db.setLog.create({
          data: {
            exerciseLogId: log.id,
            userId: user.id,
            setNumber: op.setNumber,
            weightKg: op.weightKg ?? null,
            reps: op.reps ?? null,
            rpe: op.rpe ?? null,
            durationSeconds: op.durationSeconds ?? null,
            completedAt: op.completedAt ? new Date(op.completedAt) : new Date(),
            clientId: op.clientId,
          },
        });
        synced++;
      } catch (error) {
        // Prisma validation / FK issues on a single op → conflict (terminal).
        // Connection or unexpected failures → failed (client should retry).
        const code = (error as { code?: string })?.code;
        if (code && ["P2002", "P2003", "P2025"].includes(code)) {
          conflicts++;
        } else {
          failed++;
          console.error("[sync] unexpected op failure", error);
        }
      }
    }

    return NextResponse.json({ ok: true, synced, conflicts, failed });
  } catch (error) {
    return appErrorResponse(error);
  }
}
