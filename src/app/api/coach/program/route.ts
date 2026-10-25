import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { readJson } from "@/lib/http/read-json";
import { rateLimit } from "@/lib/http/rate-limit";
import { appErrorResponse } from "@/lib/errors/respond";
import { coachProgramInput } from "@/lib/coach/program-contract";
import { assignCoachProgram } from "@/lib/coach/programs";
import { db } from "@/lib/db";
export async function POST(req: Request) {
  try {
    const actor = await requireRole("coach"); const input = coachProgramInput.parse(await readJson(req));
    const link = await db.coachClient.findUnique({ where: { coachId_athleteId: { coachId: actor.id, athleteId: input.athleteId } } });
    if (link?.status !== "active") return NextResponse.json({ ok: false, code: "authorization" }, { status: 403 });
    const quota = await rateLimit(`coach:assign:${input.athleteId}`, 10, 86400000);
    if (!quota.ok) return NextResponse.json({ ok: false, code: "rate_limit", retryAfterSeconds: quota.retryAfterSeconds }, { status: 429, headers: { "Retry-After": String(quota.retryAfterSeconds) } });
    const plan = await assignCoachProgram(actor.id, input);
    return NextResponse.json({ ok: true, planId: plan.id, planName: plan.name });
  } catch (error) { return appErrorResponse(error); }
}
