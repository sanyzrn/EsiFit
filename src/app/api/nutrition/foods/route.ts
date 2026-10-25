import { normalizePersianSearch } from "@/lib/formatting/search";
import { USDA_FOOD_SOURCES } from "@/features/nutrition/data/usda-foods";
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
    const tokens = normalizePersianSearch(q ?? "").split(" ").filter(Boolean);
    const foods = await db.food.findMany({
      where: { isPublic: true, ...(tokens.length ? { AND: tokens.map(token => ({ nameFa: { contains: token } })) } : {}) },
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
        source: USDA_FOOD_SOURCES[f.slug] ? { label: "USDA · مقدار هر سهم مشخص است", url: USDA_FOOD_SOURCES[f.slug].url } : { label: "مقدار تقریبی؛ وابسته به نوع تهیه" },
      })),
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
