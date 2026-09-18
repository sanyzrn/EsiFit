import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { z } from "zod";
import { appErrorResponse } from "@/lib/errors/respond";
import { AppError } from "@/lib/errors/app-error";
import { getEntitlements, type UserTier } from "@/lib/entitlements/entitlements";

/**
 * Mock checkout — creates a paid order (sandbox payment simulation).
 * Server recalculates totals from DB prices + entitlements; client cart
 * totals are never trusted.
 */
const schema = z.object({
  items: z.array(z.object({ productId: z.string(), qty: z.number().int().min(1).max(10) })).min(1).max(20),
});

export async function POST(req:NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ ok: false, code: "authentication", message: "برای تکمیل خرید وارد شوید." }, { status: 401 });
    }
    const body = schema.parse(await req.json());

    // Reject duplicate productIds — otherwise stock math double-counts.
    const ids = body.items.map((i) => i.productId);
    if (new Set(ids).size !== ids.length) {
      return NextResponse.json({ ok: false, code: "validation", message: "اقلام تکراری در سبد خرید هستند." }, { status: 400 });
    }

    const ent = getEntitlements(session.tier as UserTier);
    const products = await db.product.findMany({ where: { id: { in: ids }, status: "active" } });
    if (products.length !== body.items.length) {
      return NextResponse.json({ ok: false, code: "not_found", message: "برخی اقلام موجود نیستند." }, { status: 400 });
    }

    // Round per unit, exactly as /api/store/products advertises finalPriceToman —
    // rounding the subtotal instead would charge a price the catalog never showed.
    let subtotal = 0;
    let total = 0;
    const itemsJson = body.items.map((i) => {
      const p = products.find((x) => x.id === i.productId)!;
      const unitPrice = Math.round(p.priceToman * (1 - ent.storeDiscountPercent / 100));
      subtotal += p.priceToman * i.qty;
      total += unitPrice * i.qty;
      return { productId: p.id, nameFa: p.nameFa, priceToman: p.priceToman, qty: i.qty, emoji: p.emoji };
    });
    const discount = subtotal - total;

    // Decrement stock atomically; abort if any item oversells.
    const order = await db.$transaction(async (tx) => {
      for (const item of body.items) {
        const updated = await tx.product.updateMany({
          where: { id: item.productId, status: "active", stock: { gte: item.qty } },
          data: { stock: { decrement: item.qty } },
        });
        if (updated.count === 0) {
          throw new AppError("conflict", { userMessage: "موجودی برخی اقلام کافی نیست." });
        }
      }
      return tx.order.create({
        data: {
          userId: session.id,
          status: "paid",
          totalToman: total,
          discountToman: discount,
          itemsJson: JSON.stringify(itemsJson),
        },
      });
    });

    return NextResponse.json({
      ok: true,
      order: { id: order.id, totalToman: total, discountToman: discount, items: itemsJson },
      message: "سفارش ثبت شد (پرداخت آزمایشی محیط دمو).",
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
