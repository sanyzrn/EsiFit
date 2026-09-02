import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { CALCULATOR_CONFIGS } from "@/features/calculators/registry";

/**
 * Public sitemap. Only surfaces that are reachable without a session belong
 * here — authenticated app routes are noindex by nature and would leak the
 * product's private structure.
 */
export const dynamic = "force-dynamic";

const STATIC_PATHS: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/blog", priority: 0.8, changeFrequency: "daily" },
  { path: "/calculators", priority: 0.8, changeFrequency: "monthly" },
  { path: "/plans", priority: 0.7, changeFrequency: "monthly" },
  { path: "/auth/login", priority: 0.4, changeFrequency: "yearly" },
];
// /store and /community deliberately absent: both redirect anonymous visitors
// to /auth/login, so listing them would send crawlers to a login wall.


export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const now = new Date();

  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((e) => ({
    url: `${base}${e.path}`,
    lastModified: now,
    changeFrequency: e.changeFrequency,
    priority: e.priority,
  }));

  for (const calc of CALCULATOR_CONFIGS) {
    entries.push({
      url: `${base}/calculators/${calc.slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  // The blog is the only DB-backed public surface; a database hiccup must not
  // take the whole sitemap down.
  try {
    const [articles, categories] = await Promise.all([
      db.article.findMany({
        where: { status: "published" },
        select: { slug: true, updatedAt: true, category: { select: { slug: true } } },
      }),
      db.category.findMany({ select: { slug: true } }),
    ]);
    for (const c of categories) {
      entries.push({
        url: `${base}/blog/${c.slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
    for (const a of articles) {
      entries.push({
        url: `${base}/blog/${a.category.slug}/${a.slug}`,
        lastModified: a.updatedAt,
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  } catch {
    // static entries above still ship
  }

  return entries;
}
