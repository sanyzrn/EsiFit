export type CatalogProduct = { id: string; slug: string; name: string; description: string; type: string; emoji: string; priceToman: number; compareAtToman: number | null; stock: number; badge: string | null; finalPriceToman: number };
export type Catalog = { products: CatalogProduct[]; discountPercent: number; memberPrice: boolean };
