import { readJson } from "@/lib/http/read-json";
import { isValidISODate } from "@/lib/dates/jalali";
import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { claimMission } from "@/lib/domain/gamification-engine";
import { z } from "zod";

const schema = z.object({ missionId: z.string(), periodKey: z.string().refine(isValidISODate).optional() });

export async function POST(req: NextRequest) {
  try {
    const session = await requireMember();
    const body = schema.parse(await readJson(req));
    const result = await claimMission(session.id, body.missionId, body.periodKey);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return appErrorResponse(error);
  }
}
