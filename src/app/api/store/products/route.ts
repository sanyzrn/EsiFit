import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getEntitlements, type UserTier } from "@/lib/entitlements/entitlements";
import { appErrorResponse } from "@/lib/errors/respond";

/** Store catalog — discount resolved from server-side entitlements. */
export async function GET() {
  try {
    const session = await getSessionUser();
    const products = await db.product.findMany({
      where: { status: "active" },
      orderBy: { priceToman: "asc" },
    });
    const ent = getEntitlements((session?.tier as UserTier) ?? "free");
    return NextResponse.json({
      ok: true,
      products: products.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.nameFa,
        description: p.description,
        type: p.type,
        emoji: p.emoji,
        priceToman: p.priceToman,
        compareAtToman: p.compareAtToman,
        stock: p.stock,
        badge: p.badge,
        finalPriceToman: Math.round(p.priceToman * (1 - ent.storeDiscountPercent / 100)),
      })),
      discountPercent: ent.storeDiscountPercent,
      memberPrice: ent.storeDiscountPercent > 0,
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
