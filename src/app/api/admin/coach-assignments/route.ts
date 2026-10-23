import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { db } from "@/lib/db";

const assignmentSchema = z.object({
  athleteId: z.string().min(1),
  coachId: z.string().min(1).nullable(),
}).strict();

/** Admin-only roster overview. Every athlete has zero or one primary coach. */
export async function GET() {
  try {
    await requireRole("admin");
    const [coaches, athletes, links] = await Promise.all([
      db.user.findMany({
        where: { role: "coach", status: "active" },
        orderBy: { displayName: "asc" },
        select: { id: true, displayName: true, phone: true },
      }),
      db.user.findMany({
        where: { role: "member", status: "active" },
        orderBy: { displayName: "asc" },
        select: { id: true, displayName: true, phone: true, tier: true },
      }),
      db.coachClient.findMany({
        where: { status: "active", athlete: { role: "member", status: "active" } },
        orderBy: { startedAt: "desc" },
        select: { coachId: true, athleteId: true },
      }),
    ]);

    // Old seed data may have more than one link: show latest until a new admin
    // assignment normalizes that athlete to one primary coach.
    const owner = new Map<string, string>();
    for (const link of links) if (!owner.has(link.athleteId)) owner.set(link.athleteId, link.coachId);
    return NextResponse.json({
      ok: true,
      coaches,
      athletes: athletes.map((athlete) => ({
        ...athlete,
        coachId: owner.get(athlete.id) ?? null,
      })),
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}

/**
 * Primary coach assignment. Admin explicitly chooses the coach; coaches never
 * choose arbitrary athletes. Atomic relinking prevents duplicate owners.
 */
export async function PUT(request: Request) {
  try {
    await requireRole("admin");
    const parsed = assignmentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({
        ok: false, code: "validation", message: "اطلاعات تخصیص معتبر نیست.",
      }, { status: 400 });
    }
    const { athleteId, coachId } = parsed.data;
    await db.$transaction(async (tx) => {
      const athlete = await tx.user.findFirst({
        where: { id: athleteId, role: "member", status: "active" },
        select: { id: true },
      });
      if (!athlete) throw new Error("INVALID_ATHLETE");
      if (coachId) {
        const coach = await tx.user.findFirst({
          where: { id: coachId, role: "coach", status: "active" },
          select: { id: true },
        });
        if (!coach) throw new Error("INVALID_COACH");
      }
      await tx.coachClient.deleteMany({ where: { athleteId } });
      if (coachId) {
        await tx.coachClient.create({
          data: { athleteId, coachId, status: "active" },
        });
      }
    });
    return NextResponse.json({ ok: true, athleteId, coachId });
  } catch (error) {
    if (error instanceof Error && (error.message === "INVALID_ATHLETE" || error.message === "INVALID_COACH")) {
      return NextResponse.json({
        ok: false, code: "validation", message: "مربی یا ورزشکار معتبر و فعال نیست.",
      }, { status: 400 });
    }
    return appErrorResponse(error);
  }
}
