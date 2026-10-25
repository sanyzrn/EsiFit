import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { db } from "@/lib/db";
import { AI_COACH, AI_COACH_ID, isAiCoach } from "@/lib/coach/ai-coach";

const assignmentSchema = z.object({
  athleteId: z.string().min(1),
  coachId: z.string().min(1).nullable(),
}).strict();

/** Explicitly separate human coach accounts from a virtual AI coach option. */
export async function GET() {
  try {
    await requireRole("admin");
    const [humanCoaches, athletes, humanLinks, aiLinks, planningPolicy] = await Promise.all([
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
      db.aiCoachEnrollment.findMany({
        where: { status: { in: ["reserved","enabled"] }, athlete: { role: "member", status: "active" } },
        select: { athleteId: true },
      }),
      db.aiPlanningPolicy.findUnique({where:{id:"default"}}),
    ]);
    const assigned = new Map<string, string>();
    for (const enrollment of aiLinks) assigned.set(enrollment.athleteId, AI_COACH_ID);
    for (const link of humanLinks) {
      if (!assigned.has(link.athleteId)) assigned.set(link.athleteId, link.coachId);
    }
    return NextResponse.json({
      ok: true,
      coaches: [
        ...humanCoaches.map((coach) => ({ ...coach, type: "human", status: "active" })),
        {...AI_COACH,status:planningPolicy?.enabled?"active":"reserved"},
      ],
      athletes: athletes.map((athlete) => ({
        ...athlete, coachId: assigned.get(athlete.id) ?? null,
      })),
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}

/**
 * Admin-owned primary coach assignment. A human coach is a real, active User.
 * AI is an independent reservation record without API credentials, access to
 * sensitive athlete data, or any automatic training decisions.
 */
export async function PUT(request: Request) {
  try {
    await requireRole("admin");
    const parsed = assignmentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, code: "validation", message: "اطلاعات تخصیص معتبر نیست." }, { status: 400 });
    }
    const { athleteId, coachId } = parsed.data;
    const policy=await db.aiPlanningPolicy.findUnique({where:{id:"default"}});
    const aiStatus=policy?.enabled?"enabled":"reserved";
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${athleteId} FOR UPDATE`;
      const athlete = await tx.user.findFirst({
        where: { id: athleteId, role: "member", status: "active" },
        select: { id: true },
      });
      if (!athlete) throw new Error("INVALID_ATHLETE");

      if (coachId && !isAiCoach(coachId)) {
        const human = await tx.user.findFirst({
          where: { id: coachId, role: "coach", status: "active" },
          select: { id: true },
        });
        if (!human) throw new Error("INVALID_COACH");
      }

      // Only one effective primary assignment; do not touch workouts/history.
      await tx.coachClient.deleteMany({ where: { athleteId } });
      if (isAiCoach(coachId)) {
        await tx.aiCoachEnrollment.upsert({
          where: { athleteId },
          create: { athleteId, status: aiStatus },
          update: { status: aiStatus },
        });
      } else {
        await tx.aiCoachEnrollment.deleteMany({ where: { athleteId } });
        if (coachId) {
          await tx.coachClient.create({ data: { athleteId, coachId, status: "active" } });
          if(await tx.aiPlanRun.findFirst({where:{athleteId,status:"needs_review",reviewRequestedAt:{not:null}},select:{id:true}}))await tx.notification.create({data:{userId:coachId,type:"system",title:"ورزشکار نیازمند بررسی برنامه",body:"درخواست بررسی انسانی این پرونده در انتظار شماست؛ محدودیت‌ها و اطلاعات روز را مرور کنید.",actionUrl:`/coach/athletes/${athleteId}`}});
        }
      }
    });
    return NextResponse.json({
      ok: true, athleteId, coachId,
      aiStatus: isAiCoach(coachId) ? aiStatus : null,
    });
  } catch (error) {
    if (error instanceof Error && ["INVALID_ATHLETE", "INVALID_COACH"].includes(error.message)) {
      return NextResponse.json({ ok: false, code: "validation", message: "مربی یا ورزشکار معتبر و فعال نیست." }, { status: 400 });
    }
    return appErrorResponse(error);
  }
}
