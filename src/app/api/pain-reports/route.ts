import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/dates/jalali";

const REGIONS = [
  "lower_back", "shoulder", "knee", "elbow", "wrist",
  "hip", "ankle", "neck", "groin", "ribs", "other",
] as const;

/** GET /api/pain-reports — active pain/limitation reports (privacy-sensitive; own data only). */
export async function GET() {
  try {
    const session = await requireUser();
    const reports = await db.painReport.findMany({
      where: { userId: session.id, status: "active" },
      orderBy: { reportedOn: "desc" },
      take: 20,
    });
    return NextResponse.json({ ok: true, reports });
  } catch (error) {
    return appErrorResponse(error);
  }
}

const createSchema = z.object({
  bodyRegion: z.enum(REGIONS),
  side: z.enum(["left", "right", "bilateral", "center", "unknown"]).optional(),
  severity: z.number().int().min(1).max(10),
  note: z.string().max(280).optional(),
});

/**
 * POST /api/pain-reports — self-reported limitation (not a diagnosis).
 * Drives the smart swap engine's hard pain filter.
 */
export async function POST(req: Request) {
  try {
    const session = await requireUser();
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, code: "validation", message: "گزارش درد کامل نیست." }, { status: 400 });
    }

    const report = await db.painReport.create({
      data: {
        userId: session.id,
        reportedOn: todayISO(session.timezone),
        bodyRegion: parsed.data.bodyRegion,
        side: parsed.data.side ?? "unknown",
        severity: parsed.data.severity,
        note: parsed.data.note?.trim() ?? "",
        status: "active",
      },
    });

    return NextResponse.json({ ok: true, report: { id: report.id, bodyRegion: report.bodyRegion } });
  } catch (error) {
    return appErrorResponse(error);
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["improving", "resolved"]),
});

/** PATCH /api/pain-reports — update own report status. */
export async function PATCH(req: Request) {
  try {
    const session = await requireUser();
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, code: "validation" }, { status: 400 });
    }
    const report = await db.painReport.findUnique({ where: { id: parsed.data.id } });
    if (!report || report.userId !== session.id) {
      return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    }
    await db.painReport.update({ where: { id: report.id }, data: { status: parsed.data.status } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return appErrorResponse(error);
  }
}
