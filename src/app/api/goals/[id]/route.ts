import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { db } from "@/lib/db";

const patchSchema = z.object({
  status: z.enum(["active", "achieved", "archived"]).optional(),
  title: z.string().max(80).optional(),
  targetValue: z.number().positive().finite().optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** PATCH /api/goals/[id] — update own goal (title/target/status). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, code: "validation" }, { status: 400 });
    }

    const goal = await db.goal.findUnique({ where: { id } });
    if (!goal || goal.userId !== session.id) {
      return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    }

    const updated = await db.goal.update({
      where: { id },
      data: {
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.title != null ? { title: parsed.data.title } : {}),
        ...(parsed.data.targetValue != null ? { targetValue: parsed.data.targetValue } : {}),
        ...(parsed.data.targetDate ? { targetDate: parsed.data.targetDate } : {}),
      },
    });
    return NextResponse.json({ ok: true, goal: { id: updated.id, status: updated.status } });
  } catch (error) {
    return appErrorResponse(error);
  }
}

/** DELETE /api/goals/[id] — remove own goal. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const goal = await db.goal.findUnique({ where: { id } });
    if (!goal || goal.userId !== session.id) {
      return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    }
    await db.goal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return appErrorResponse(error);
  }
}
