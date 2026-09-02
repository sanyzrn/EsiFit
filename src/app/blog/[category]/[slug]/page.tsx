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

type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "list"; items: string[] }
  | { type: "callout"; title: string; text: string }
  | { type: "steps"; items: string[] };

export async function generateMetadata({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category, slug } = await params;
  const article = await db.article.findUnique({ where: { slug }, include: { category: true } });
  if (!article || article.category.slug !== category) return {};
  return {
    title: article.metaTitle || article.title,
    description: article.metaDescription || article.excerpt,
    alternates: { canonical: `/blog/${category}/${slug}` },
    openGraph: {
      type: "article",
      title: article.metaTitle || article.title,
      description: article.metaDescription || article.excerpt,
      publishedTime: article.publishedAt?.toISOString(),
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;
  const article = await db.article.findUnique({
    where: { slug },
    include: {
      author: true,
      reviewer: true,
      category: true,
      sources: true,
    },
  });
  if (!article || article.category.slug !== category || article.status !== "published") notFound();

  const [session, related] = await Promise.all([
    getSessionUser(),
    db.article.findMany({
      where: { status: "published", categoryId: article.categoryId, NOT: { id: article.id } },
      take: 3,
      include: { category: true },
    }),
  ]);

  const blocks = JSON.parse(article.contentBlocks) as Block[];

  // JSON-LD per CONTENT_STRATEGY §7
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    datePublished: article.publishedAt?.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    author: { "@type": "Person", name: article.author.name },
    ...(article.reviewer ? { reviewedBy: { "@type": "Person", name: article.reviewer.name } } : {}),
    publisher: { "@type": "Organization", name: "اسی‌فیت" },
    inLanguage: "fa",
  };

  return (
    <AppShell session={session} flags={resolveEnabledFlags()}>
      <PublicNavbar />
      <script
        type="application/ld+json"
        // "<" is escaped so a "</script>" sequence inside any article field
        // cannot close the tag early and inject markup.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <article className="pt-28 pb-10 max-w-3xl mx-auto w-full px-4 lg:px-8 min-h-[70vh]">
        <nav className="text-xs text-esi-text-muted" aria-label="مسیر">
          <Link href="/blog" className="hover:text-esi-text-primary">مجله</Link>
          <span className="mx-1">/</span>
          <Link href={`/blog/${category}`} className="hover:text-esi-text-primary">{article.category.nameFa}</Link>
        </nav>

        <header className="mt-4">
          <span className="text-5xl" aria-hidden>{article.coverEmoji}</span>
          <h1 className="mt-4 text-3xl lg:text-4xl font-extrabold leading-[1.3] tracking-tight">{article.title}</h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-esi-text-muted">
            <span className="flex items-center gap-2">
              <span aria-hidden>{article.author.avatarEmoji}</span>
              <span className="font-medium text-esi-text-secondary">{article.author.name}</span>
              {article.author.credentialLabel && <span>• {article.author.credentialLabel}</span>}
            </span>
            {article.reviewer && (
              <span>بازبینی علمی: {article.reviewer.name}</span>
            )}
            <span>انتشار: {article.publishedAt ? formatJalaliLong(article.publishedAt) : "—"}</span>
            <span>به‌روزرسانی: {formatJalaliLong(article.updatedAt)}</span>
            <span>{toPersianDigits(article.readingMinutes)} دقیقه مطالعه</span>
          </div>
        </header>

        <div className="mt-10 space-y-5">
          {blocks.map((b, i) => {
            switch (b.type) {
              case "h2":
                return <h2 key={i} className="text-2xl font-bold pt-4">{b.text}</h2>;
              case "h3":
                return <h3 key={i} className="text-lg font-bold pt-2">{b.text}</h3>;
              case "p":
                return <p key={i} className="text-[15px] leading-8 text-esi-text-secondary">{b.text}</p>;
              case "list":
                return (
                  <ul key={i} className="space-y-2 ps-1">
                    {b.items.map((item, j) => (
                      <li key={j} className="flex gap-2.5 text-[15px] leading-7 text-esi-text-secondary">
                        <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                        {item}
                      </li>
                    ))}
                  </ul>
                );
              case "steps":
                return (
                  <ol key={i} className="space-y-3">
                    {b.items.map((item, j) => (
                      <li key={j} className="flex gap-3 text-[15px] leading-7 text-esi-text-secondary">
                        <span className="h-6 w-6 shrink-0 rounded-full bg-primary/12 text-primary text-xs font-bold flex items-center justify-center">
                          {toPersianDigits(j + 1)}
                        </span>
                        {item}
                      </li>
                    ))}
                  </ol>
                );
              case "callout":
                return (
                  <aside key={i} className="rounded-2xl border border-primary/25 bg-primary/5 p-5">
                    <p className="text-sm font-bold text-primary">{b.title}</p>
                    <p className="mt-1.5 text-sm leading-7 text-esi-text-secondary">{b.text}</p>
                    {article.calculatorSlug && (
                      <Link
                        href={`/calculators/${article.calculatorSlug}`}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-transform active:scale-95"
                      >
                        باز کردن ماشین‌حساب
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="rotate-180"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                      </Link>
                    )}
                  </aside>
                );
              default:
                return null;
            }
          })}
        </div>

        {/* Sources */}
        {article.sources.length > 0 && (
          <section className="mt-12 rounded-2xl border border-border bg-surface-1 p-5" aria-label="منابع">
            <h2 className="text-sm font-bold mb-3">منابع</h2>
            <ol className="space-y-2">
              {article.sources.map((s) => (
                <li key={s.id} className="text-xs leading-6 text-esi-text-muted">
                  {s.title} — <span className="text-esi-text-secondary">{s.publisher}</span>
                  {s.publishedOn ? ` (${toPersianDigits(s.publishedOn)})` : ""}
                  {s.doi ? ` — DOI: ${s.doi}` : ""}
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-12" aria-label="مقالات مرتبط">
            <h2 className="text-lg font-bold mb-4">مقالات مرتبط</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((a) => (
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
          </section>
        )}
      </article>
      <Footer />
    </AppShell>
  );
}
