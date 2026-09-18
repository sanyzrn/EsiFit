import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { db } from "@/lib/db";
import { EQUIPMENT_KEYS, parseAvailableEquipment, serializeAvailableEquipment } from "@/lib/workout/equipment";

const patchSchema = z.object({
  availableEquipment: z.array(z.string()).max(20),
});

/** GET /api/settings/profile — current equipment availability for the signed-in user. */
export async function GET() {
  try {
    const session = await requireUser();
    const profile = await db.userProfile.findUnique({
      where: { userId: session.id },
      select: { availableEquipment: true },
    });
    const set = parseAvailableEquipment(profile?.availableEquipment);
    return NextResponse.json({
      ok: true,
      availableEquipment: set ? [...set] : [...EQUIPMENT_KEYS],
      unrestricted: set == null,
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}

/** PATCH /api/settings/profile — update equipment; plans can be regenerated from Workouts. */
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireUser();
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, code: "validation", message: "فهرست وسایل نامعتبر است." }, { status: 400 });
    }
    const raw = serializeAvailableEquipment(parsed.data.availableEquipment);
    await db.userProfile.upsert({
      where: { userId: session.id },
      create: { userId: session.id, availableEquipment: raw },
      update: { availableEquipment: raw },
    });
    const set = parseAvailableEquipment(raw);
    return NextResponse.json({
      ok: true,
      availableEquipment: set ? [...set] : [...EQUIPMENT_KEYS],
      unrestricted: set == null,
      message: "وسایل ذخیره شد. برای اعمال در برنامه، از صفحه تمرین «بازسازی برنامه» را بزنید.",
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
