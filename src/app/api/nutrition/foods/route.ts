import { rateLimit } from "@/lib/http/rate-limit";
import { clientIp } from "@/lib/http/client-ip";
import { appErrorResponse } from "@/lib/errors/respond";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const querySchema = z.object({ q: z.string().max(60).optional() });

/** Public food search (used by nutrition diary). Persian-first matching. */
export async function GET(req: NextRequest) {
  try {
    const rl = await rateLimit(`foods:search:${clientIp(req) ?? "unknown"}`, 60, 60_000);
    if (!rl.ok) return NextResponse.json({ ok: false, code: "rate_limit", retryAfterSeconds: rl.retryAfterSeconds }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } });
    const q = querySchema.parse({ q: new URL(req.url).searchParams.get("q") ?? "" }).q?.trim();
    const foods = await db.food.findMany({
      where: { isPublic: true, ...(q ? { nameFa: { contains: q } } : {}) },
      take: 30,
      orderBy: { nameFa: "asc" },
    });
    return NextResponse.json({
      ok: true,
      foods: foods.map((f) => ({
        id: f.id,
        nameFa: f.nameFa,
        category: f.category,
        servingAmount: f.servingAmount,
        servingUnit: f.servingUnit,
        calories: f.calories,
        proteinG: f.proteinG,
        carbsG: f.carbsG,
        fatG: f.fatG,
      })),
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
