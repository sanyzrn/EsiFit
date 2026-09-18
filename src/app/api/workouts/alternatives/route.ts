import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { db } from "@/lib/db";
import { rankSwaps, type SwapCandidate } from "@/lib/domain/swap-engine";
import { getUserEquipmentSet } from "@/lib/workout/catalog";

/**
 * GET /api/workouts/alternatives?exerciseId=…
 * Ranked smart-swap candidates for one exercise, respecting active pain reports
 * and the user's profile equipment availability.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const exerciseId = url.searchParams.get("exerciseId");
    if (!exerciseId) {
      return NextResponse.json({ ok: false, code: "validation", message: "حرکت مشخص نشده است." }, { status: 400 });
    }

    const source = await db.exercise.findUnique({
      where: { id: exerciseId },
      include: { muscles: { include: { muscleGroup: true } } },
    });
    if (!source) {
      return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    }

    const [candidates, painReports, availableEquipment] = await Promise.all([
      db.exercise.findMany({
        where: { id: { not: source.id } },
        include: { muscles: { include: { muscleGroup: true } } },
      }),
      db.painReport.findMany({ where: { userId: user.id, status: "active" }, select: { bodyRegion: true } }),
      getUserEquipmentSet(user.id),
    ]);

    const toCandidate = (e: (typeof candidates)[number]): SwapCandidate => ({
      slug: e.slug,
      nameFa: e.nameFa,
      equipment: e.equipment,
      movementPattern: e.movementPattern,
      difficulty: e.difficulty,
      isCompound: e.isCompound,
      isUnilateral: e.isUnilateral,
      primaryMuscles: e.muscles.filter((m) => m.role === "primary").map((m) => m.muscleGroup.slug),
      secondaryMuscles: e.muscles.filter((m) => m.role === "secondary").map((m) => m.muscleGroup.slug),
    });

    const ranked = rankSwaps(
      {
        slug: source.slug,
        movementPattern: source.movementPattern,
        difficulty: source.difficulty,
        isUnilateral: source.isUnilateral,
        primaryMuscles: source.muscles.filter((m) => m.role === "primary").map((m) => m.muscleGroup.slug),
        secondaryMuscles: source.muscles.filter((m) => m.role === "secondary").map((m) => m.muscleGroup.slug),
      },
      candidates.map(toCandidate),
      {
        availableEquipment,
        painRegions: painReports.map((p) => p.bodyRegion),
        excludeSlugs: [source.slug],
      },
    );

    const bySlug = new Map(candidates.map((c) => [c.slug, c]));
    return NextResponse.json({
      ok: true,
      source: { id: source.id, nameFa: source.nameFa },
      painRegions: painReports.map((p) => p.bodyRegion),
      equipmentRestricted: availableEquipment != null,
      alternatives: ranked
        .map((r) => {
          const row = bySlug.get(r.candidate.slug);
          if (!row) return null;
          return {
            exerciseId: row.id,
            nameFa: r.candidate.nameFa,
            equipment: r.candidate.equipment,
            difficulty: r.candidate.difficulty,
            score: Math.round(r.score * 100) / 100,
            reasonsFa: r.reasonsFa,
            painSafe: r.painSafe,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x != null),
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
