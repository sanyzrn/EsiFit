import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { db } from "@/lib/db";
import { getCoachAthleteDetail } from "@/lib/coach/data";

/** GET /api/coach/athlete/[id] — full detail for one roster athlete. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("coach_or_admin");
    const { id } = await params;

    // Authorization: coach must own the link; admin supervises anyone.
    if (session.role !== "admin") {
      const link = await db.coachClient.findUnique({
        where: { coachId_athleteId: { coachId: session.id, athleteId: id } },
      });
      if (!link) {
        return NextResponse.json(
          { ok: false, code: "authorization", message: "این ورزشکار در فهرست شما نیست." },
          { status: 403 },
        );
      }
    }

    const detail = await getCoachAthleteDetail(id);
    if (!detail) {
      return NextResponse.json({ ok: false, code: "not_found", message: "ورزشکار پیدا نشد." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, detail });
  } catch (error) {
    return appErrorResponse(error);
  }
}
