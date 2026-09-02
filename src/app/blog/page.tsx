import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/layout/app-shell";
import { ArticleCard } from "@/components/features/article-card";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { formatRelative, formatJalaliLong } from "@/lib/dates/jalali";
import { toPersianDigits } from "@/lib/formatting/numbers";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "مجله اسی‌فیت",
  description: "مقالات تمرینی، تغذیه و ریکاوری مبتنی بر شواهد علمی — با ذکر منبع و مرور تخصصی.",
};

export default async function BlogIndexPage() {
  const session = await getSessionUser();
  const flags = resolveEnabledFlags();
  if (!flags.BLOG) notFound();

  const [articles, categories] = await Promise.all([
    db.article.findMany({
      where: { status: "published" },
      orderBy: { publishedAt: "desc" },
      include: { author: true, category: true },
    }),
    db.category.findMany({ orderBy: { orderIndex: "asc" } }),
  ]);

  return (
    <AppShell session={session} flags={flags}>
      <PublicNavbar />
      <div className="pt-28 max-w-6xl mx-auto w-full">
        <PageHeader title="مجله اسی‌فیت" description="هر ادعا به منبع گره خورده است؛ محتوای سلامت با مرور تخصصی منتشر می‌شود." />
        <nav className="px-4 lg:px-8 mt-2 flex flex-wrap gap-2" aria-label="دسته‌بندی‌ها">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/blog/${c.slug}`}
              className="rounded-full border border-border bg-surface-1 px-4 py-2 text-xs text-esi-text-secondary hover:border-primary/50 hover:text-esi-text-primary transition-colors"
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
      <Footer />
    </AppShell>
  );
}
