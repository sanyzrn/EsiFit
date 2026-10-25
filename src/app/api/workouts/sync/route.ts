import { withSessionLock } from "@/lib/workout/session-lock";
import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth/session";
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
  isWarmup: z.boolean().default(false),
});

const bodySchema = z.object({ sets: z.array(setOp).max(200) });

export async function POST(req: NextRequest) {
  try {
    const user = await requireMember();
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
        const result = await withSessionLock(op.sessionId, async tx => {
          const session = await tx.workoutSession.findUnique({ where: { id: op.sessionId }, select: { userId: true } });
          if (!session || session.userId !== user.id) return false;
          const existing = await tx.setLog.findUnique({ where: { userId_clientId: { userId: user.id, clientId: op.clientId } } });
          if (existing) return true;
          // Order can change after swaps; exercise identity is canonical.
          let log = await tx.exerciseLog.findFirst({ where: { sessionId: op.sessionId, exerciseId: op.exerciseId }, orderBy: { orderIndex: "asc" } });
          if (!log) {
            const exercise = await tx.exercise.findUnique({ where: { id: op.exerciseId }, select: { id: true } });
            if (!exercise) return false;
            log = await tx.exerciseLog.create({ data: { sessionId: op.sessionId, exerciseId: op.exerciseId, orderIndex: op.orderIndex } });
          }
          await tx.setLog.create({ data: {
            exerciseLogId: log.id, userId: user.id, setNumber: op.setNumber,
            weightKg: op.weightKg ?? null, reps: op.reps ?? null, rpe: op.rpe ?? null,
            durationSeconds: op.durationSeconds ?? null, isWarmup: op.isWarmup,
            completedAt: op.completedAt ? new Date(op.completedAt) : new Date(), clientId: op.clientId,
          } });
          return true;
        });
        if (result) synced++; else conflicts++;
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
