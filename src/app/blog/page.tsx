import { publicMetadata } from "@/lib/seo/site";
import { getPublicArticles, getPublicCategories } from "@/lib/content/public-articles";
import { getSessionUser } from "@/lib/auth/session";
import { PublicPageShell } from "@/components/layout/public-page-shell";
import { ArticleCard } from "@/components/features/article-card";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { formatJalaliLong } from "@/lib/dates/jalali";
import { toPersianDigits } from "@/lib/formatting/numbers";
import Link from "next/link";

export const metadata = publicMetadata("/blog", "مجله اسی‌فیت", "مقالات تمرینی، تغذیه و ریکاوری مبتنی بر شواهد علمی — با ذکر منبع.");

export default async function BlogIndexPage() {
  const session = await getSessionUser();
  const flags = resolveEnabledFlags();
  if (!flags.BLOG) return <PublicPageShell session={session} flags={flags} title="مجله اسی‌فیت" description="مجله به‌زودی دوباره در دسترس قرار می‌گیرد." backHref="/"><p className="px-4 py-8 text-sm text-esi-text-secondary">محتوای مجله در حال آماده‌سازی است. <Link href="/calculators" className="text-primary">ابزارهای محاسبه</Link> در دسترس‌اند.</p></PublicPageShell>;

  const [articles, categories] = await Promise.all([
    getPublicArticles(),
    getPublicCategories(),
  ]);

  return (
    <PublicPageShell
      session={session}
      flags={flags}
      title="مجله اسی‌فیت"
      description="راهنمای تمرین، تغذیه و استفاده از اسی‌فیت؛ با منابع مشخص و بدون وعده‌های اغراق‌آمیز."
      backHref={session ? "/dashboard" : undefined}
      showFooter
    >
      <div className="max-w-6xl mx-auto w-full">
        <nav className="px-4 lg:px-8 mt-2 flex flex-wrap gap-2" aria-label="دسته‌بندی‌ها">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/blog/${c.slug}`}
              className="rounded-full border border-border bg-surface-1 px-4 py-2 text-xs text-esi-text-secondary hover:border-primary/50 hover:text-esi-text-primary transition-colors min-h-11 inline-flex items-center"
            >
              {c.nameFa}
            </Link>
          ))}
        </nav>
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
        </div>
      </div>
    </PublicPageShell>
  );
}
