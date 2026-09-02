import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { claimMission } from "@/lib/domain/gamification-engine";
import { z } from "zod";

const schema = z.object({ missionId: z.string() });

export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const body = schema.parse(await req.json());
    const result = await claimMission(session.id, body.missionId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return appErrorResponse(error);
  }
}
