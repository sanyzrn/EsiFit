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
import { KhatamStar } from "@/components/motion/khatam";
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

      {/* ============ FINAL CTA ============ */}
      <section className="mx-auto max-w-6xl px-4 lg:px-8 pb-4">
        <RevealOnScroll>
          <div className="esi-hero-graphite relative isolate overflow-hidden rounded-[32px] border border-border px-6 py-16 text-center lg:px-16 lg:py-24">
            <div aria-hidden className="esi-aurora -z-10" />
            <div aria-hidden className="absolute inset-0 -z-10 [mask-image:radial-gradient(60%_80%_at_50%_50%,black,transparent)]">
              <div className="esi-pattern" />
            </div>
            <KhatamStar size={420} strokeWidth={0.4} spin className="pointer-events-none absolute -bottom-40 -start-24 text-primary/30" />
            <KhatamStar size={320} strokeWidth={0.4} spin="reverse" className="pointer-events-none absolute -top-32 -end-16 text-turquoise/30" />
            <div className="relative">
              <h2 className="font-display text-4xl leading-[1.3] lg:text-6xl">امروز اولین روز ثبت‌شده شماست</h2>
              <p className="mx-auto mt-5 max-w-lg text-sm leading-7 text-esi-text-secondary lg:text-base">
                فقط با شماره موبایل وارد شوید؛ برنامه شروع به‌طور خودکار ساخته می‌شود و جلسه اول همین امروز می‌تواند باشد.
              </p>
              <Button asChild size="lg" className="esi-sheen esi-glow mt-9 h-14 px-10 text-base">
                <Link href={session ? "/dashboard" : "/auth/login"}>{session ? "رفتن به داشبورد" : "ساخت رایگان حساب"}</Link>
              </Button>
              <p className="mt-4 text-xs text-esi-text-muted">بدون کارت بانکی — پلن رایگان همیشه رایگان می‌ماند.</p>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      <InstallPrompt />
    </PublicPageShell>
  );
}
