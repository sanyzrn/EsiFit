import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { Footer } from "@/components/layout/footer";
import { ArticleCard } from "@/components/features/article-card";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { formatJalaliLong } from "@/lib/dates/jalali";
import { toPersianDigits } from "@/lib/formatting/numbers";

export const dynamic = "force-dynamic";

// The dynamic segment is [category]; destructuring `slug` here yielded
// undefined and made every category page throw at the Prisma call.
type CategoryParams = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: CategoryParams) {
  const { category: slug } = await params;
  const category = await db.category.findUnique({ where: { slug } });
  if (!category) return { title: "دسته‌بندی" };
  return { title: `${category.nameFa} | مجله اسی‌فیت`, description: category.description };
}

export default async function BlogCategoryPage({ params }: CategoryParams) {
  const { category: slug } = await params;
  const category = await db.category.findUnique({ where: { slug } });
  if (!category) notFound();

  const [session, articles] = await Promise.all([
    getSessionUser(),
    db.article.findMany({
      where: { status: "published", category: { slug } },
      orderBy: { publishedAt: "desc" },
      include: { author: true, category: true },
    }),
  ]);

  return (
    <AppShell session={session} flags={resolveEnabledFlags()}>
      <PublicNavbar />
      <div className="pt-28 max-w-6xl mx-auto w-full min-h-[60vh]">
        <nav className="px-4 lg:px-8 text-xs text-esi-text-muted" aria-label="مسیر">
          <Link href="/blog" className="hover:text-esi-text-primary">مجله</Link>
          <span className="mx-1">/</span>
          <span className="text-esi-text-secondary">{category.nameFa}</span>
        </nav>
        <header className="px-4 lg:px-8 mt-3">
          <h1 className="text-3xl font-bold">{category.nameFa}</h1>
          <p className="mt-2 text-sm text-esi-text-secondary">{category.description}</p>
        </header>
        <div className="px-4 lg:px-8 mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 pb-6">
          {articles.map((a) => (
            <ArticleCard
              key={a.id}
              href={`/blog/${a.category.slug}/${a.slug}`}
              emoji={a.coverEmoji}
              title={a.title}
              excerpt={a.excerpt}
              category={a.category.nameFa}
              minutes={toPersianDigits(a.readingMinutes)}
              date={a.publishedAt ? formatJalaliLong(a.publishedAt) : ""}
            />
          ))}
          {articles.length === 0 && (
            <p className="text-sm text-esi-text-muted col-span-full py-12 text-center">هنوز مقاله‌ای در این دسته منتشر نشده است.</p>
          )}
        </div>
      </div>
      <Footer />
    </AppShell>
  );
}
