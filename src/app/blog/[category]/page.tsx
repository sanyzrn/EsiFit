import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { PublicPageShell } from "@/components/layout/public-page-shell";
import { ArticleCard } from "@/components/features/article-card";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { formatJalaliLong } from "@/lib/dates/jalali";
import { toPersianDigits } from "@/lib/formatting/numbers";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

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
    <PublicPageShell
      session={session}
      flags={resolveEnabledFlags()}
      showFooter
      backHref="/blog"
    >
      <div className="max-w-6xl mx-auto w-full min-h-[50vh] pb-6">
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
            <div className="col-span-full py-12 text-center space-y-4">
              <p className="text-sm text-esi-text-muted">هنوز مقاله‌ای در این دسته منتشر نشده است.</p>
              <Button asChild variant="secondary">
                <Link href="/blog">بازگشت به مجله</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </PublicPageShell>
  );
}
