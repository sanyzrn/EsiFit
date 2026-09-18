import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { appErrorResponse } from "@/lib/errors/respond";
import { z } from "zod";
import { todayISO } from "@/lib/dates/jalali";

const postSchema = z.object({
  ml: z.number().int().min(50).max(2000),
  clientId: z.string().min(6).max(64),
  loggedAt: z.string().datetime().optional(),
});

/** Water logging — offline-safe with idempotent clientId. */
export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const body = postSchema.parse(await req.json());

    const existing = await db.waterLog.findUnique({
      where: { userId_clientId: { userId: session.id, clientId: body.clientId } },
    });
    if (existing) {
      // Idempotent replay from offline queue
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const loggedAt = body.loggedAt ? new Date(body.loggedAt) : new Date();
    const logDate = todayISO(session.timezone);

    const created = await db.waterLog.create({
      data: {
        userId: session.id,
        ml: body.ml,
        loggedAt,
        logDate,
        syncStatus: "synced",
        clientId: body.clientId,
      },
    });

    const dayTotal = await db.waterLog.aggregate({
      where: { userId: session.id, logDate },
      _sum: { ml: true },
    });
    const profile = await db.userProfile.findUnique({ where: { userId: session.id } });

    // Daily water mission progress — compare against the mission target,
    // store progress against that same target (never profile ≠ mission mix).
    const mission = await db.mission.findUnique({ where: { slug: "daily-water" } });
    const dayMl = dayTotal._sum.ml ?? 0;
    if (mission && dayMl >= mission.target) {
      await db.userMissionProgress.upsert({
        where: { userId_missionId_periodKey: { userId: session.id, missionId: mission.id, periodKey: logDate } },
        create: {
          userId: session.id, missionId: mission.id, periodKey: logDate,
          progress: dayMl, target: mission.target, completedAt: new Date(),
        },
        update: { progress: dayMl },
      }).catch(() => undefined);
    }

    return NextResponse.json({
      ok: true,
      water: { ml: created.ml, dayTotal: dayTotal._sum.ml ?? 0, targetMl: profile?.dailyWaterTargetMl ?? 2500 },
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
