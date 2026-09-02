import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { db } from "@/lib/db";

/**
 * GET /api/analytics/pr-history?slug=…
 * Full PR timeline for one exercise (record-breaking rows, oldest → newest).
 * With no slug: list of exercises that have history (for the picker).
 */
export async function GET(req: Request) {
  try {
    const session = await requireUser();
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
      const rows = await db.personalRecord.groupBy({
        by: ["exerciseId"],
        where: { userId: session.id },
        _count: { exerciseId: true },
      });
      const exercises = await db.exercise.findMany({
        where: { id: { in: rows.map((r) => r.exerciseId) } },
        select: { id: true, slug: true, nameFa: true },
      });
      return NextResponse.json({
        ok: true,
        exercises: exercises.map((e) => ({
          slug: e.slug,
          nameFa: e.nameFa,
          prCount: rows.find((r) => r.exerciseId === e.id)?._count.exerciseId ?? 0,
        })),
      });
    }

    const exercise = await db.exercise.findUnique({ where: { slug }, select: { id: true, nameFa: true } });
    if (!exercise) {
      return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    }

    const timeline = await db.personalRecord.findMany({
      where: { userId: session.id, exerciseId: exercise.id, recordType: "weight" },
      orderBy: { achievedAt: "asc" },
      select: { value: true, unit: true, achievedAt: true, isCurrent: true },
    });

    return NextResponse.json({
      ok: true,
      exercise: { slug, nameFa: exercise.nameFa },
      timeline: timeline.map((t) => ({
        value: t.value,
        unit: t.unit,
        achievedAt: t.achievedAt.toISOString(),
        isCurrent: t.isCurrent,
      })),
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
