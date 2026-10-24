import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowUpLeft, Check, Dumbbell, Flame, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";

/** First-party campaign portrait supplied by the user; true alpha, no photo frame. */
const HERO_IMAGE = "/media/esifit-athlete.webp";

const strengths = [
  { label: "ثبت تمرین و ست‌ها", Icon: Dumbbell },
  { label: "تغذیه با غذاهای ایرانی", Icon: HeartPulse },
  { label: "پیشرفت قابل اندازه‌گیری", Icon: Flame },
];

export function LandingHero({ signedIn }: { signedIn: boolean }) {
  return (
    <section
      aria-labelledby="esi-landing-headline"
      className="esi-campaign-hero relative isolate overflow-hidden"
    >
      <div className="esi-campaign-noise pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="esi-campaign-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div aria-hidden="true" className="esi-campaign-side-label">ESIFIT · MOVE FORWARD</div>

      <div className="esi-campaign-layout relative mx-auto grid max-w-7xl px-5 sm:px-8 lg:px-10">
        {/* Primary message is first in reading order, and in the top viewport on mobile. */}
        <div className="esi-campaign-copy esi-campaign-enter relative z-20">
          <div
            className="esi-campaign-eyebrow inline-flex items-center gap-2.5 text-[11px] font-bold tracking-wide text-[var(--hero-muted)]"
          >
            <span aria-hidden="true" className="esi-campaign-signal" />
            تجربه متفاوت تمرین، از همین‌جا
            <span className="h-px w-7 bg-[var(--hero-hairline)]" aria-hidden="true" />
            <span dir="ltr" className="font-mono text-[10px] tracking-[0.19em]">EST. ESIFIT</span>
          </div>

          <h1
            id="esi-landing-headline"
            className="esi-campaign-title font-display"
          >
            <span className="esi-campaign-line">هر روز،</span>
            <span className="esi-campaign-line">
              <span className="esi-campaign-word">قوی‌تر</span>
              <span className="esi-campaign-period" aria-hidden="true">.</span>
            </span>
            <span className="esi-campaign-line esi-campaign-last-line">از دیروز.</span>
          </h1>

          <p
            className="esi-campaign-description text-sm leading-7 text-[var(--hero-muted)] sm:text-base sm:leading-8"
          >
            برنامه تمرین، ثبت هوشمند ست‌ها و تغذیه در یک مسیر ساده.
            اسی‌فیت کمکت می‌کند پیشرفتت را ببینی، نه فقط درباره‌اش فکر کنی.
          </p>

          <div
            className="esi-campaign-actions flex flex-wrap items-center gap-3"
          >
            <Button
              asChild size="lg"
              className="esi-campaign-cta min-h-13 flex-1 gap-3 rounded-full px-6 text-sm font-bold sm:flex-none sm:text-base"
            >
              <Link href={signedIn ? "/dashboard" : "/auth/login"}>
                <span>{signedIn ? "ادامه مسیر من" : "شروع رایگان"}</span>
                <ArrowUpLeft size={19} aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild variant="outline" size="lg"
              className="esi-campaign-secondary min-h-13 flex-1 gap-2 rounded-full px-5 text-sm sm:flex-none"
            >
              <Link href="/calculators">
                ابزارهای رایگان
                <ArrowLeft size={17} aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <div
            className="esi-campaign-trust flex items-center gap-2 text-[11px] text-[var(--hero-muted)]"
          >
            <Check size={15} className="text-[var(--hero-orange)]" aria-hidden="true" />
            بدون کارت بانکی · با شماره موبایل
          </div>
        </div>

        {/* Same cutout at every breakpoint; art stays separate from readable copy. */}
        <div
          className="esi-campaign-stage esi-campaign-enter relative isolate"
        >
          <Image
            src={HERO_IMAGE}
            fill
            preload
            sizes="(min-width: 1280px) 580px, (min-width: 1024px) 46vw, (min-width: 640px) 440px, 92vw"
            alt="ورزشکار اسی‌فیت با لباس نارنجی"
            className="esi-campaign-athlete object-contain"
          />
        </div>
      </div>

      <div className="relative z-10 border-y border-[var(--hero-hairline)] bg-[var(--hero-strip)]">
        <ul className="esi-campaign-strengths mx-auto grid max-w-7xl grid-cols-3 px-5 sm:px-8 lg:px-10">
          {strengths.map(({ label, Icon }, index) => (
            <li
              key={label}
              className="flex min-h-24 flex-col justify-center gap-2 px-2 py-4 text-center sm:min-h-19 sm:flex-row sm:justify-start sm:gap-3 sm:px-0 sm:text-start"
            >
              <Icon size={20} strokeWidth={1.7} className="shrink-0 text-[var(--hero-orange)]" aria-hidden="true" />
              <span className="text-[11px] font-semibold leading-5 text-[var(--hero-text)] sm:text-[13px]">{label}</span>
              <span className="ms-auto hidden font-mono text-[11px] text-[var(--hero-faint)] sm:inline" dir="ltr">
                0{index + 1}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
