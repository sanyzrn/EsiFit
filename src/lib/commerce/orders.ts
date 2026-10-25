import { z } from "zod";

/** Stored receipt snapshots never resolve current product names or prices. */
const item = z.object({
  productId: z.string(), nameFa: z.string(), priceToman: z.number().int().nonnegative(),
  qty: z.number().int().positive(), emoji: z.string().optional(),
  unitPriceToman: z.number().int().nonnegative().optional(),
  lineTotalToman: z.number().int().nonnegative().optional(),
});
export type OrderItem = z.infer<typeof item>;
export type OrderReceipt = {
  id: string; status: string; createdAt: string; currency: "IRT";
  totalToman: number; discountToman: number; items: OrderItem[];
};

export function orderReceipt(order: { id: string; status: string; createdAt: Date; totalToman: number; discountToman: number; itemsJson: string }): OrderReceipt {
  let items: OrderItem[] = [];
  try { items = z.array(item).parse(JSON.parse(order.itemsJson)); } catch { /* Legacy malformed details: keep the authoritative receipt totals. */ }
  return { id: order.id, status: order.status, createdAt: order.createdAt.toISOString(), currency: "IRT", totalToman: order.totalToman, discountToman: order.discountToman, items };
}
