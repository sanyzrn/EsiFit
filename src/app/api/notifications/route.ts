import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { z } from "zod";

const readSchema = z.object({ id: z.string().optional(), all: z.boolean().optional() });

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ ok: true, notifications: [], unread: 0 });
    const notifications = await db.notification.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    return NextResponse.json({
      ok: true,
      notifications,
      unread: notifications.filter((n) => !n.readAt).length,
    });
  } catch {
    return NextResponse.json({ ok: false, code: "unexpected", message: "خطا" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ ok: false, code: "authentication" }, { status: 401 });
    const body = readSchema.parse(await req.json());
    if (body.all) {
      await db.notification.updateMany({ where: { userId: session.id, readAt: null }, data: { readAt: new Date() } });
    } else if (body.id) {
      await db.notification.updateMany({ where: { id: body.id, userId: session.id }, data: { readAt: new Date() } });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, code: "unexpected" }, { status: 400 });
  }
}
