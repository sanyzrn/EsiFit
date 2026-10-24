import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { PublicPageShell } from "@/components/layout/public-page-shell";
import { RevealOnScroll } from "@/components/ui/reveal-on-scroll";
import { SectionHeader } from "@/components/ui/section-header";
import { InstallPrompt } from "@/components/features/offline-sync-indicator";
import { LandingHero } from "@/components/landing/hero";
import { FeatureBento } from "@/components/landing/bento";
import { DayFlow } from "@/components/landing/day-flow";
import { BmiPlayground } from "@/components/landing/bmi-playground";
import { ScrollProgress } from "@/components/motion/scroll-progress";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { formatRelative } from "@/lib/dates/jalali";
import { toPersianDigits } from "@/lib/formatting/numbers";
import { Button } from "@/components/ui/button";
import { ArticleCard } from "@/components/features/article-card";

export const dynamic = "force-dynamic";

async function getLatestArticles() {
  try {
    return await db.article.findMany({
      where: { status: "published" },
      orderBy: { publishedAt: "desc" },
      take: 3,
      include: { author: true, category: true },
    });
  } catch {
    return [];
  }
}

export default async function LandingPage() {
  const [session, flags, articles] = await Promise.all([
    getSessionUser(),
    Promise.resolve(resolveEnabledFlags()),
    getLatestArticles(),
  ]);

  return (
    <PublicPageShell session={session} flags={flags} showFooter flush backHref={undefined}>
      <ScrollProgress />
      <LandingHero signedIn={Boolean(session)} />

      {/* ============ FEATURES ============ */}
      <section className="mx-auto max-w-6xl px-4 lg:px-8 py-24">
        <RevealOnScroll>
          <SectionHeader
            title="یک محصول کامل، نه چند ابزار پراکنده"
            description="هر بخش با بقیه صحبت می‌کند: تمرین شما آمادگی فردا را می‌سازد، آمادگی به تغذیه وصل است و همه‌چیز به تحلیل تبدیل می‌شود."
          />
        </RevealOnScroll>
        <FeatureBento />
      </section>

      {/* ============ A DAY ============ */}
      <section className="relative overflow-hidden border-y border-border bg-surface-1">
        <div aria-hidden className="absolute inset-0 [mask-image:linear-gradient(to_left,black,transparent_70%)]">
          <div className="esi-pattern" />
        </div>
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-24 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <RevealOnScroll>
              <SectionHeader
                title="یک روز با اسی‌فیت"
                description="از اولین نگاه صبح تا جمع‌بندی آخر هفته — هر قدم، داده‌ای می‌سازد که قدم بعد را هوشمندتر می‌کند."
              />
            </RevealOnScroll>
          </div>
          <DayFlow />
        </div>
      </section>

      {/* ============ TRY IT ============ */}
      <section className="mx-auto max-w-6xl px-4 lg:px-8 py-24">
        <RevealOnScroll>
          <SectionHeader
            title="اول حساب کن، بعد تصمیم بگیر"
            description="همین حالا امتحان کن — بدون ثبت‌نام و بدون ذخیره‌ی هیچ داده‌ای. ثبت‌نام فقط برای تاریخچه و شخصی‌سازی است."
          />
        </RevealOnScroll>
        <RevealOnScroll delay={0.1} className="mt-10">
          <BmiPlayground />
        </RevealOnScroll>
      </section>

      {/* ============ ARTICLES ============ */}
      {articles.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 lg:px-8 pb-24">
          <RevealOnScroll>
            <SectionHeader
              title="محتوای مبتنی بر شواهد، نه باور عامیانه"
              description="هر ادعا به منبع گره خورده است. محتوای سلامت با مرور تخصصی منتشر می‌شود."
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href="/blog">همه مقالات</Link>
                </Button>
              }
            />
          </RevealOnScroll>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 mt-10">
            {articles.map((a, i) => (
              <RevealOnScroll key={a.id} delay={i * 0.07}>
                <ArticleCard
                  href={`/blog/${a.category.slug}/${a.slug}`}
                  emoji={a.coverEmoji}
                  title={a.title}
                  excerpt={a.excerpt}
                  category={a.category.nameFa}
                  minutes={toPersianDigits(a.readingMinutes)}
                  date={a.publishedAt ? formatRelative(a.publishedAt) : ""}
                />
              </RevealOnScroll>
            ))}
          </div>
        </section>
      )}

      {/* Minimal final action — hero above remains the only editorial art section. */}
      <section className="mx-auto max-w-6xl px-4 pb-6 lg:px-8">
        <div className="rounded-2xl border border-border bg-surface-1 px-6 py-12 text-center sm:py-16">
          <p className="text-xs font-bold text-primary">از همین امروز</p>
          <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
            قدم اول رو بردار
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-esi-text-secondary">
            برنامه تمرین و تغذیه‌ات رو در یک جای ساده و منظم داشته باش؛ پیشرفت واقعی از ثبت قدم‌های کوچیک شروع می‌شه.
          </p>
          <Button asChild size="lg" className="mt-6 min-h-12 px-8">
            <Link href={session ? "/dashboard" : "/auth/login"}>
              {session ? "رفتن به داشبورد" : "شروع رایگان"}
            </Link>
          </Button>
          <p className="mt-3 text-xs text-esi-text-muted">بدون نیاز به کارت بانکی</p>
        </div>
      </section>

      <InstallPrompt />
    </PublicPageShell>
  );
}
