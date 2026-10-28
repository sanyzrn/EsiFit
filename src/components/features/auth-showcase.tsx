"use client";

import * as React from "react";
import { KhatamDial, KhatamStar } from "@/components/motion/khatam";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { BrandMark } from "@/components/layout/brand-mark";
import { toPersianDigits } from "@/lib/formatting/numbers";

const PROMISES = [
  "برنامه ۴ هفته‌ای همین امروز ساخته می‌شود",
  "ثبت ست‌ها حتی بدون اینترنت",
  "بدون رمز عبور — فقط یک کد پیامکی",
];

/** Brand side of the sign-in screen: a dial that "reads" a score, and the three promises. */
export function AuthShowcase() {
  const [score, setScore] = React.useState(64);
  React.useEffect(() => {
    // A slow, believable drift — the dial is alive, not a looping GIF.
    const values = [64, 72, 81, 86, 78, 86];
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % values.length;
      setScore(values[i]);
    }, 3200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="esi-hero-graphite relative isolate hidden h-full overflow-hidden lg:flex lg:flex-col lg:justify-between p-12 xl:p-16">
      <div aria-hidden className="esi-aurora -z-10" />
      <div aria-hidden className="absolute inset-0 -z-10 [mask-image:radial-gradient(80%_70%_at_50%_45%,black,transparent)]">
        <div className="esi-pattern" />
      </div>
      <BrandMark />

      <div className="relative mx-auto flex w-full max-w-md flex-col items-center text-center">
        <KhatamStar size={560} strokeWidth={0.35} spin className="pointer-events-none absolute -z-10 top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 text-primary/15 rtl:translate-x-1/2" />
        <KhatamDial value={score} size={300} color="var(--primary)" label={`نمونه امتیاز آمادگی ${score}`} delay={0.2}>
          <span className="font-display text-[84px] leading-none tabular-nums">
            <AnimatedCounter value={score} duration={1.2} />
          </span>
          <span className="mt-1 text-sm text-turquoise">آماده تمرین</span>
        </KhatamDial>
        <h2 className="font-display mt-10 text-4xl leading-[1.35] xl:text-5xl">
          اولین جلسه‌ات، یک شماره موبایل فاصله دارد
        </h2>
      </div>

      <ul className="space-y-3">
        {PROMISES.map((p, i) => (
          <li key={p} className="esi-rise flex items-center gap-3 text-sm text-esi-text-secondary" style={{ "--i": i + 3 } as React.CSSProperties}>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-turquoise/15 text-turquoise">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            {p}
          </li>
        ))}
        <li className="pt-2 text-xs text-esi-text-muted">{toPersianDigits(94)} غذای ایرانی · {toPersianDigits(71)} حرکت · {toPersianDigits(8)} ماشین‌حساب</li>
      </ul>
    </div>
  );
}
