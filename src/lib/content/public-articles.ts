import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
// Cache public editorial data only. Cookie/session HTML, stock and discounts stay dynamic.
const options = { revalidate: 60, tags: ["public-editorial"] };
const cachedArticles = unstable_cache(async (category?: string) => db.article.findMany({
  where: { status: "published", ...(category ? { category: { slug: category } } : {}) },
  orderBy: { publishedAt: "desc" }, include: { author: true, category: true },
}), ["public-articles-v1"], options);
const cachedCategories = unstable_cache(async () => db.category.findMany({ orderBy: { orderIndex: "asc" } }), ["public-categories-v1"], options);
const cachedArticle = unstable_cache(async (category: string, slug: string) => db.article.findFirst({
  where: { slug, status: "published", category: { slug: category } },
  include: { author: true, reviewer: true, category: true, sources: true },
}), ["public-article-v1"], options);
function dates<T extends { publishedAt: Date | null; updatedAt: Date }>(article: T): T {
  return { ...article, publishedAt: article.publishedAt ? new Date(article.publishedAt) : null, updatedAt: new Date(article.updatedAt) };
}
export async function getPublicArticles(category?: string) { return (await cachedArticles(category)).map(dates); }
export const getPublicCategories = cachedCategories;
export async function getPublicArticle(category: string, slug: string) { const article = await cachedArticle(category, slug); return article ? dates(article) : null; }
