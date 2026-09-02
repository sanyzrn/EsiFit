import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { getCoachRoster } from "@/lib/coach/data";

export async function GET() {
  try {
    const session = await requireRole("coach_or_admin");
    const roster = await getCoachRoster(session.id);
    return NextResponse.json({ ok: true, roster });
  } catch (error) {
    return appErrorResponse(error);
  }
}
