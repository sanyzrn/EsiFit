import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMember } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { orderReceipt } from "@/lib/commerce/orders";
import { appErrorResponse } from "@/lib/errors/respond";

/** Stable owner-scoped receipt pages; client-supplied owner IDs are never used. */
export async function GET(req: NextRequest) {
  try {
    const member = await requireMember();
    const raw = z.string().max(200).optional().parse(new URL(req.url).searchParams.get("cursor") ?? undefined);
    const cursor = raw ? z.tuple([z.string().datetime(), z.string().min(1).max(100)]).parse(raw.split("!")) : null;
    const rows = await db.order.findMany({
      where: { userId: member.id, ...(cursor ? { OR: [{ createdAt: { lt: new Date(cursor[0]) } }, { createdAt: new Date(cursor[0]), id: { lt: cursor[1] } }] } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 21,
    });
    const page = rows.slice(0, 20);
    const last = page.at(-1);
    return NextResponse.json({ ok: true, orders: page.map(orderReceipt), nextCursor: rows.length > 20 && last ? `${last.createdAt.toISOString()}!${last.id}` : null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return appErrorResponse(error); }
}
