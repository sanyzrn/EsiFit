import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { Footer } from "@/components/layout/footer";
import { RevealOnScroll } from "@/components/ui/reveal-on-scroll";
import { SectionHeader } from "@/components/ui/section-header";
import { InstallPrompt } from "@/components/features/offline-sync-indicator";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { formatJalaliLong, formatRelative } from "@/lib/dates/jalali";
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
    <AppShell session={session} flags={flags}>
      <PublicNavbar />

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden esi-hero-graphite pt-32 pb-20 lg:pt-40 lg:pb-28">
        {/* barely-perceptible ambient orbs */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="esi-ambient absolute -top-24 -start-24 h-96 w-96 rounded-full bg-mint-400/8 blur-3xl" />
          <div className="absolute top-1/3 -end-32 h-80 w-80 rounded-full bg-blue-500/8 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 lg:px-8 grid lg:grid-cols-[1.15fr_0.85fr] gap-14 items-center">
          <div>
            <RevealOnScroll>
              <span className="inline-flex items-center gap-2 rounded-full border border-mint-400/25 bg-mint-400/8 px-3.5 py-1.5 text-xs font-medium text-mint-400">
                <span className="h-1.5 w-1.5 rounded-full bg-mint-400 animate-pulse" aria-hidden />
                اپلیکیشن نصب‌شدنی — بدون نیاز به فروشگاه اپ
              </span>
            </RevealOnScroll>
            <RevealOnScroll delay={0.08}>
              <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.15] tracking-tight">
                تمرین هوشمند،
                <br />
                <span className="esi-gradient-brand-text">پیشرفت قابل اندازه‌گیری</span>
              </h1>
            </RevealOnScroll>
            <RevealOnScroll delay={0.16}>
              <p className="mt-6 max-w-xl text-base lg:text-lg leading-8 text-esi-text-secondary">
                اسی‌فیت همه‌چیز را در یک تجربه فارسی و موبایل‌پسند جمع کرده: برنامه تمرین زنده با ثبت
                آفلاین، تغذیه با غذاهای ایرانی، امتیاز آمادگی روزانه، تحلیل عضلانی و دستیار هوشمند.
              </p>
            </RevealOnScroll>
            <RevealOnScroll delay={0.24}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="h-12 px-7 text-base esi-glow">
                  <Link href="/auth/login">شروع رایگان — فقط شماره موبایل</Link>
                </Button>
                <Button asChild variant="secondary" size="lg" className="h-12 px-6">
                  <Link href="/calculators">محاسبه شاخص‌های بدنی</Link>
                </Button>
              </div>
            </RevealOnScroll>
            <RevealOnScroll delay={0.32}>
              <dl className="mt-10 grid grid-cols-3 gap-4 max-w-md">
                {[
                  { v: "۹۴", l: "غذای ایرانی در پایگاه داده" },
                  { v: "۷۱", l: "حرکت با راهنمای فارسی" },
                  { v: "۸", l: "ماشین‌حساب تخصصی" },
                ].map((s) => (
                  <div key={s.l} className="rounded-2xl border border-border bg-surface-1/60 p-4 text-center backdrop-blur-sm">
                    <dt className="sr-only">{s.l}</dt>
                    <dd className="text-2xl font-extrabold tabular-nums esi-gradient-brand-text">{s.v}</dd>
                    <dd className="mt-1 text-[11px] leading-4 text-esi-text-muted">{s.l}</dd>
                  </div>
                ))}
              </dl>
            </RevealOnScroll>
          </div>

          {/* Hero mock — readiness orb + streak, the product's signature */}
          <RevealOnScroll delay={0.2} className="hidden lg:block">
            <div className="relative rounded-3xl border border-border bg-surface-1/80 p-8 shadow-[var(--shadow-float)] backdrop-blur">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-esi-text-muted">شنبه، امروز</p>
                  <p className="font-bold">سلام امیر 👋</p>
                </div>
                <span className="rounded-full bg-mint-400/10 px-3 py-1 text-xs font-medium text-mint-400">وی‌آی‌پی</span>
              </div>
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <div className="relative mx-auto h-36 w-36">
                    <svg viewBox="0 0 144 144" className="-rotate-90 h-full w-full">
                      <circle cx="72" cy="72" r="60" fill="none" stroke="var(--surface-3)" strokeWidth="10" />
                      <circle
                        cx="72" cy="72" r="60" fill="none" stroke="#5BE7C4" strokeWidth="10"
                        strokeLinecap="round" strokeDasharray={377} strokeDashoffset={377 * 0.14}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-extrabold tabular-nums">۸۶</span>
                      <span className="text-[10px] text-mint-400">آماده تمرین</span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-esi-text-muted">امتیاز آمادگی</p>
                </div>
                <div className="space-y-3">
                  {[
                    { icon: "🔥", label: "زنجیره فعالیت", value: "۱۲ روز" },
                    { icon: "🏋️", label: "تمرین امروز", value: "پرس و زیربغل" },
                    { icon: "💧", label: "آب", value: "۷۵٪ هدف" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/70 px-4 py-3 w-56">
                      <span className="text-lg" aria-hidden>{row.icon}</span>
                      <div className="text-start">
                        <p className="text-[11px] text-esi-text-muted">{row.label}</p>
                        <p className="text-sm font-semibold">{row.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="mx-auto max-w-6xl px-4 lg:px-8 py-20">
        <SectionHeader
          eyebrow="چرا اسی‌فیت؟"
          title="یک محصول کامل، نه چند ابزار پراکنده"
          description="هر بخش با بقیه صحبت می‌کند: تمرین شما آمادگی فردا را می‌سازد، آمادگی به تغذیه وصل است و همه‌چیز به تحلیل تبدیل می‌شود."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 mt-10">
          {[
            { icon: "🏋️", title: "حالت تمرین زنده", text: "ثبت ست‌ها با تایمر استراحت، صفحه مینیمال برای حین تمرین و همگام‌سازی خودکار بعد از قطعی اینترنت — هیچ ست و تکراری گم نمی‌شود." },
            { icon: "🍲", title: "تغذیه با غذای ایرانی", text: "از چلوکباب تا عدسی؛ پایگاه داده فارسی با مقدار سرو واقعی و حلقه‌های ماکرو که همان لحظه پر می‌شوند." },
            { icon: "💜", title: "امتیاز آمادگی روزانه", text: "ترکیب شفاف خواب، بار تمرینی و پیوستگی — با توضیح اینکه هر عامل چقدر در عدد امروز نقش داشته." },
            { icon: "🔥", title: "نقشه حرارتی عضلات", text: "بدن شما به‌صورت آناتومیک نشان می‌دهد کدام عضله در ۳۰ روز گذشته کار شده و کدام فراموش شده است." },
            { icon: "🏆", title: "گیمیفیکیشن بی‌ادعا", text: "امتیاز تجربه، نشان و ماموریت‌های روزانه که به خودعضله‌سازی وصل‌اند، نه به باز کردن قفل محتوای پولی." },
            { icon: "🤖", title: "دستیار هوشمند", text: "مربی فارسی‌زبان مبتنی بر هوش مصنوعی با محدودیت سهمیه شفاف — و خط قرمزهای ایمنی سلامت." },
          ].map((f, i) => (
            <RevealOnScroll key={f.title} delay={i * 0.06}>
              <article className="group h-full rounded-3xl border border-border bg-surface-1 p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-raised)]">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-2xl" aria-hidden>
                  {f.icon}
                </span>
                <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-6 text-esi-text-secondary">{f.text}</p>
              </article>
            </RevealOnScroll>
          ))}
        </div>
      </section>

      {/* ============ CALCULATORS BAND ============ */}
      <section className="border-y border-border bg-surface-1">
        <div className="mx-auto max-w-6xl px-4 lg:px-8 py-16 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold">اول حساب کن، بعد تصمیم بگیر</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-esi-text-secondary">
              هشت ماشین‌حساب تخصصی با فرمول‌های استاندارد علمی — نتیجه بدون ثبت‌نام نمایش داده می‌شود.
              ثبت‌نام فقط برای ذخیره تاریخچه و شخصی‌سازی است.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["BMI", "TDEE و کالری", "پروتئین و ماکرو", "۱RM", "وزن ایده‌آل", "آب روزانه"].map((c) => (
              <span key={c} className="rounded-full border border-border bg-surface-2 px-3.5 py-1.5 text-xs text-esi-text-secondary">
                {c}
              </span>
            ))}
            <Button asChild variant="ghost" size="sm" className="h-9">
              <Link href="/calculators">
                همه ماشین‌حساب‌ها
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="rotate-180"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ============ ARTICLES ============ */}
      {articles.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 lg:px-8 py-20">
          <SectionHeader
            eyebrow="مجله اسی‌فیت"
            title="محتوای مبتنی بر شواهد، نه باور عامیانه"
            description="هر ادعا به منبع گره خورده است. محتوای سلامت با مرور تخصصی منتشر می‌شود."
            action={
              <Button asChild variant="secondary" size="sm" className="h-9">
                <Link href="/blog">همه مقالات</Link>
              </Button>
            }
          />
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
          <div className="relative overflow-hidden rounded-[28px] border border-border p-10 lg:p-16 text-center">
            <div aria-hidden className="absolute inset-0 opacity-70">
              <div className="esi-ambient absolute -bottom-32 start-1/4 h-72 w-72 rounded-full bg-mint-400/12 blur-3xl" />
              <div className="absolute -top-24 end-1/4 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
            </div>
            <div className="relative">
              <h2 className="text-3xl lg:text-4xl font-extrabold leading-tight">
                امروز اولین روز ثبت‌شده شماست
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-sm lg:text-base leading-7 text-esi-text-secondary">
                فقط با شماره موبایل وارد شوید؛ برنامه شروع به‌طور خودکار ساخته می‌شود و جلسه اول
                همین امروز می‌تواند باشد.
              </p>
              <Button asChild size="lg" className="mt-8 h-12 px-8 text-base esi-glow">
                <Link href="/auth/login">ساخت رایگان حساب</Link>
              </Button>
              <p className="mt-4 text-xs text-esi-text-muted">بدون کارت بانکی — پلن رایگان همیشه رایگان می‌ماند.</p>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      <Footer />
      <InstallPrompt />
    </AppShell>
  );
}
