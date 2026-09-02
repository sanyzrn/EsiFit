import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { db } from "@/lib/db";

/** GET /api/workouts/exercises — compact library list for the live picker. */
export async function GET() {
  try {
    await requireUser();
    const exercises = await db.exercise.findMany({
      select: { id: true, nameFa: true, slug: true, equipment: true, isCompound: true },
      orderBy: { nameFa: "asc" },
    });
    return NextResponse.json({ ok: true, exercises });
  } catch (error) {
    return appErrorResponse(error);
  }
}
