import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { readJson } from "@/lib/http/read-json";
import { appErrorResponse } from "@/lib/errors/respond";
import { db } from "@/lib/db";
import { lockCoachAthlete } from "@/lib/coach/programs";
const input = z.object({ athleteId: z.string().min(1), note: z.string().trim().max(1000) }).strict();
export async function PATCH(req: Request) {
  try {
    const actor = await requireRole("coach"); const data = input.parse(await readJson(req));
    await db.$transaction(async tx => { const { link } = await lockCoachAthlete(tx, actor.id, data.athleteId); await tx.coachClient.update({ where: { id: link.id }, data: { note: data.note } }); });
    return NextResponse.json({ ok: true });
  } catch (error) { return appErrorResponse(error); }
}
