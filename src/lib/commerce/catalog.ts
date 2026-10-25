import "server-only";
import type { Catalog } from "./catalog-types";
import { db } from "@/lib/db";
import { getEntitlements, type UserTier } from "@/lib/entitlements/entitlements";
/** Uncached: live stock and member prices are resolved for this request. */
export async function getCatalog(tier: UserTier = "free"): Promise<Catalog> {
  const products = await db.product.findMany({ where: { status: "active" }, orderBy: { priceToman: "asc" } });
  const ent = getEntitlements(tier);
  return { products: products.map(p => ({ id: p.id, slug: p.slug, name: p.nameFa, description: p.description, type: p.type, emoji: p.emoji, priceToman: p.priceToman, compareAtToman: p.compareAtToman, stock: p.stock, badge: p.badge, finalPriceToman: Math.round(p.priceToman * (1 - ent.storeDiscountPercent / 100)) })), discountPercent: ent.storeDiscountPercent, memberPrice: ent.storeDiscountPercent > 0 };
}
