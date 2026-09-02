import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { z } from "zod";
import { appErrorResponse } from "@/lib/errors/respond";
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

    const ent = getEntitlements(session.tier as UserTier);
    const productIds = body.items.map((i) => i.productId);
    const products = await db.product.findMany({ where: { id: { in: productIds }, status: "active" } });
    if (products.length !== body.items.length) {
      return NextResponse.json({ ok: false, code: "not_found", message: "برخی اقلام موجود نیستند." }, { status: 400 });
    }

    let subtotal = 0;
    const itemsJson = body.items.map((i) => {
      const p = products.find((x) => x.id === i.productId)!;
      subtotal += p.priceToman * i.qty;
      return { productId: p.id, nameFa: p.nameFa, priceToman: p.priceToman, qty: i.qty, emoji: p.emoji };
    });
    const discount = Math.round(subtotal * ent.storeDiscountPercent / 100);
    const total = subtotal - discount;

    const order = await db.order.create({
      data: {
        userId: session.id,
        status: "paid",
        totalToman: total,
        discountToman: discount,
        itemsJson: JSON.stringify(itemsJson),
      },
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
