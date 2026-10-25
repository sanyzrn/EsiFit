import { readJson } from "@/lib/http/read-json";
import { evaluateBadges, refreshDerivedMissions } from "@/lib/domain/gamification-engine";
import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { appErrorResponse } from "@/lib/errors/respond";
import { z } from "zod";
import { isoDateOnly } from "@/lib/dates/jalali";

const postSchema = z.object({
  ml: z.number().int().min(50).max(2000),
  clientId: z.string().min(6).max(64),
  loggedAt: z.string().datetime().optional(),
});

/** Water logging — offline-safe with idempotent clientId. */
export async function POST(req: NextRequest) {
  try {
    const session = await requireMember();
    const body = postSchema.parse(await readJson(req));

    const existing = await db.waterLog.findUnique({
      where: { userId_clientId: { userId: session.id, clientId: body.clientId } },
    });
    if (existing) {
      // Idempotent replay from offline queue
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // Offline entries replay later: bucket by when the water was drunk (never in
    // the future), not by when the queue happened to flush.
    const now = new Date();
    const claimedAt = body.loggedAt ? new Date(body.loggedAt) : now;
    const loggedAt = claimedAt.getTime() > now.getTime() ? now : claimedAt;
    const logDate = isoDateOnly(loggedAt, session.timezone);

    let created;
    try {
      created = await db.waterLog.create({
        data: {
          userId: session.id,
          ml: body.ml,
          loggedAt,
          logDate,
          syncStatus: "synced",
          clientId: body.clientId,
        },
      });
    } catch (error) {
      // Two flushes of the same offline entry racing: the unique clientId wins once.
      if ((error as { code?: string })?.code === "P2002") return NextResponse.json({ ok: true, duplicate: true });
      throw error;
    }

    const dayTotal = await db.waterLog.aggregate({
      where: { userId: session.id, logDate },
      _sum: { ml: true },
    });
    const profile = await db.userProfile.findUnique({ where: { userId: session.id } });

    await refreshDerivedMissions(session.id, session.timezone, logDate);
    await evaluateBadges(session.id);

    return NextResponse.json({
      ok: true,
      water: { ml: created.ml, dayTotal: dayTotal._sum.ml ?? 0, targetMl: profile?.dailyWaterTargetMl ?? 2500 },
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
