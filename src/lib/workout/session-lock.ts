import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/** Serialize changes to a session's exercise list; no schema migration or
 * destructive consolidation of existing logs is needed. */
export async function withSessionLock<T>(sessionId: string, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "WorkoutSession" WHERE "id" = ${sessionId} FOR UPDATE`;
    return work(tx);
  });
}
