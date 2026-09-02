import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const querySchema = z.object({ q: z.string().max(60).optional() });

/** Public food search (used by nutrition diary). Persian-first matching. */
export async function GET(req: NextRequest) {
  try {
    const q = querySchema.parse({ q: new URL(req.url).searchParams.get("q") ?? "" }).q?.trim();
    const foods = await db.food.findMany({
      where: q ? { nameFa: { contains: q } } : {},
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
  } catch {
    return NextResponse.json({ ok: false, code: "unexpected", message: "خطا در جستجو" }, { status: 500 });
  }
}
