import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { appErrorResponse } from "@/lib/errors/respond";
import { z } from "zod";
import { todayISO, addDaysISO } from "@/lib/dates/jalali";

const getSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

const mealOrder = ["breakfast", "lunch", "snack", "dinner"] as const;
export const MEAL_SLOT_FA: Record<string, string> = {
  breakfast: "صبحانه",
  lunch: "ناهار",
  snack: "میان‌وعده",
  dinner: "شام",
};

export async function GET(req: NextRequest) {
  try {
    const session = await requireUser();
    const date = getSchema.parse({ date: new URL(req.url).searchParams.get("date") ?? undefined }).date ?? todayISO(session.timezone);

    const [day, profile, yesterday] = await Promise.all([
      db.nutritionDay.findUnique({
        where: { userId_logDate: { userId: session.id, logDate: date } },
        include: { entries: { include: { food: true } } },
      }),
      db.userProfile.findUnique({ where: { userId: session.id } }),
      db.nutritionDay.findUnique({
        where: { userId_logDate: { userId: session.id, logDate: addDaysISO(date, -1) } },
        include: { entries: { include: { food: true } } },
      }),
    ]);

    const totals = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };
    const slots: Record<string, Array<{ id: string; foodName: string; emoji: string; quantity: number; servingUnit: string; servingAmount: number; calories: number; proteinG: number; carbsG: number; fatG: number }>> = {};
    for (const slot of mealOrder) slots[slot] = [];

    for (const entry of day?.entries ?? []) {
      const mult = entry.quantity * entry.servingMultiplier;
      totals.calories += entry.food.calories * mult;
      totals.proteinG += entry.food.proteinG * mult;
      totals.carbsG += entry.food.carbsG * mult;
      totals.fatG += entry.food.fatG * mult;
      totals.fiberG += entry.food.fiberG * mult;
      slots[entry.mealSlot]?.push({
        id: entry.id,
        foodName: entry.food.nameFa,
        emoji: foodEmoji(entry.food.category),
        quantity: entry.quantity,
        servingUnit: entry.food.servingUnit,
        servingAmount: entry.food.servingAmount,
        calories: Math.round(entry.food.calories * mult),
        proteinG: Math.round(entry.food.proteinG * mult),
        carbsG: Math.round(entry.food.carbsG * mult),
        fatG: Math.round(entry.food.fatG * mult),
      });
    }

    const water = await db.waterLog.aggregate({ where: { userId: session.id, logDate: date }, _sum: { ml: true } });

    return NextResponse.json({
      ok: true,
      date,
      totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, Math.round(v)])),
      targets: profile
        ? {
            calories: profile.dailyCalorieTarget ?? 2400,
            proteinG: profile.dailyProteinTarget ?? 150,
            carbsG: profile.dailyCarbTarget ?? 300,
            fatG: profile.dailyFatTarget ?? 70,
          }
        : null,
      water: { ml: water._sum.ml ?? 0, targetMl: profile?.dailyWaterTargetMl ?? 2500 },
      slots,
      yesterdayCalories: Math.round(
        (yesterday?.entries ?? []).reduce((a, e) => a + e.food.calories * e.quantity * e.servingMultiplier, 0),
      ),
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}

const addSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  foodId: z.string(),
  mealSlot: z.enum(["breakfast", "lunch", "snack", "dinner"]),
  quantity: z.number().min(0.1).max(20).default(1),
  clientId: z.string().min(6).max(64),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const body = addSchema.parse(await req.json());
    const date = body.date ?? todayISO(session.timezone);

    const food = await db.food.findUnique({ where: { id: body.foodId } });
    if (!food) return NextResponse.json({ ok: false, code: "not_found", message: "غذا یافت نشد." }, { status: 404 });

    const day = await db.nutritionDay.upsert({
      where: { userId_logDate: { userId: session.id, logDate: date } },
      create: { userId: session.id, logDate: date },
      update: {},
    });

    const dupe = await db.mealEntry.findUnique({
      where: { userId_clientId: { userId: session.id, clientId: body.clientId } },
    }).catch(() => null);
    if (!dupe) {
      await db.mealEntry.create({
        data: {
          nutritionDayId: day.id,
          userId: session.id,
          foodId: food.id,
          mealSlot: body.mealSlot,
          quantity: body.quantity,
          servingMultiplier: 1,
          clientId: body.clientId,
        },
      });
    }

    // Daily protein mission tracking
    return NextResponse.json({ ok: true });
  } catch (error) {
    return appErrorResponse(error);
  }
}

const deleteSchema = z.object({ entryId: z.string() });

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireUser();
    const body = deleteSchema.parse(await req.json());
    const entry = await db.mealEntry.findUnique({
      where: { id: body.entryId },
      include: { nutritionDay: true },
    });
    if (!entry || entry.nutritionDay.userId !== session.id) {
      return NextResponse.json({ ok: false, code: "not_found", message: "یافت نشد." }, { status: 404 });
    }
    await db.mealEntry.delete({ where: { id: entry.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return appErrorResponse(error);
  }
}

function foodEmoji(category: string): string {
  const map: Record<string, string> = {
    persian_dishes: "🍲", protein: "🍗", grains: "🍚", dairy: "🧀", fruit: "🍎",
    vegetables: "🥗", nuts: "🥜", snacks: "🍫", beverages: "🥤", fast_food: "🍔",
    breakfast: "🍳", general: "🍽️",
  };
  return map[category] ?? "🍽️";
}
