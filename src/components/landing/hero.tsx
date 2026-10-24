"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowUpLeft, Check, Dumbbell, Flame, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * EsiFit campaign hero — editorial, action-first, Persian/RTL native.
 * Source photo is a temporary, replaceable Unsplash Free image.
 * Replace HERO_IMAGE with a first-party portrait when brand photography is ready.
 */
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1100&q=80";

const strengths = [
  { label: "ثبت تمرین و ست‌ها", Icon: Dumbbell },
  { label: "تغذیه با غذاهای ایرانی", Icon: HeartPulse },
  { label: "پیشرفت قابل اندازه‌گیری", Icon: Flame },
];

export function LandingHero({ signedIn }: { signedIn: boolean }) {
  const reduce = useReducedMotion();
  const entry = reduce
    ? undefined
    : { duration: 0.62, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <section
      aria-labelledby="esi-landing-headline"
      className="esi-campaign-hero relative isolate overflow-hidden"
    >
      <div className="esi-campaign-noise pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="esi-campaign-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div aria-hidden="true" className="esi-campaign-side-label">ESIFIT · MOVE FORWARD</div>

      <div className="relative mx-auto grid max-w-7xl items-center gap-5 px-5 pb-9 pt-28 sm:px-8 sm:pb-12 lg:min-h-[690px] lg:grid-cols-[1.05fr_0.95fr] lg:gap-5 lg:px-10 lg:pb-12 lg:pt-36">
        {/* Primary message is first in reading order, and in the top viewport on mobile. */}
        <div className="relative z-20 max-w-[680px] pb-2 lg:pb-12">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={entry}
            className="mb-6 inline-flex items-center gap-2.5 text-[11px] font-bold tracking-wide text-[var(--hero-muted)] sm:mb-7"
          >
            <span aria-hidden="true" className="esi-campaign-signal" />
            تجربه متفاوت تمرین، از همین‌جا
            <span className="h-px w-7 bg-[var(--hero-hairline)]" aria-hidden="true" />
            <span dir="ltr" className="font-mono text-[10px] tracking-[0.19em]">EST. ESIFIT</span>
          </motion.div>

          <motion.h1
            id="esi-landing-headline"
            initial={reduce ? false : { opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...entry, delay: reduce ? 0 : 0.09 }}
            className="esi-campaign-title font-display"
          >
            <span className="block">هر روز،</span>
            <span className="block">
              <span className="esi-campaign-word">قوی‌تر</span>
              <span className="esi-campaign-period" aria-hidden="true">.</span>
            </span>
            <span className="block">از دیروز.</span>
          </motion.h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...entry, delay: reduce ? 0 : 0.18 }}
            className="mt-5 max-w-md text-[13px] leading-7 text-[var(--hero-muted)] sm:mt-6 sm:text-base sm:leading-8"
          >
            برنامه تمرین، ثبت هوشمند ست‌ها و تغذیه در یک مسیر ساده.
            اسی‌فیت کمکت می‌کند پیشرفتت را ببینی، نه فقط درباره‌اش فکر کنی.
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...entry, delay: reduce ? 0 : 0.26 }}
            className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center"
          >
            <Button
              asChild size="lg"
              className="esi-campaign-cta min-h-13 w-full justify-between gap-6 rounded-xl px-6 text-base font-bold sm:w-auto sm:justify-center"
            >
              <Link href={signedIn ? "/dashboard" : "/auth/login"}>
                <span>{signedIn ? "ادامه مسیر من" : "شروع رایگان"}</span>
                <ArrowUpLeft size={19} aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild variant="outline" size="lg"
              className="esi-campaign-secondary min-h-13 w-full rounded-xl px-6 text-sm sm:w-auto"
            >
              <Link href="/calculators">
                ابزارهای رایگان
                <ArrowLeft size={17} aria-hidden="true" />
              </Link>
            </Button>
          </motion.div>

          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: reduce ? 0 : 0.45 }}
            className="mt-7 flex items-center gap-2 text-[11px] text-[var(--hero-muted)]"
          >
            <Check size={15} className="text-[var(--hero-orange)]" aria-hidden="true" />
            بدون کارت بانکی · با شماره موبایل
          </motion.div>
        </div>

        {/* Portrait art: intentionally image-forward rather than a dashboard mockup. */}
        <motion.div
          initial={reduce ? false : { opacity: 0, x: -28, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: reduce ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
          className="esi-campaign-stage relative isolate mx-auto w-full max-w-[570px]"
          aria-label="تصویر ورزشی از تمرین با وزنه"
        >
          <span className="esi-campaign-orbit pointer-events-none absolute" aria-hidden="true" />
          <div className="esi-campaign-photo-shell relative overflow-hidden">
            {/* Replaceable licensed photo, served through Next.js optimization. */}
            <Image
              src={HERO_IMAGE}
              fill
              preload
              sizes="(min-width: 1024px) 570px, (min-width: 640px) 80vw, 100vw"
              alt="ورزشکار در حال آماده‌شدن برای بلندکردن هالتر در باشگاه"
              className="esi-campaign-photo object-cover"
            />
            <div className="esi-campaign-photo-shade pointer-events-none absolute inset-0" aria-hidden="true" />
            <p className="esi-campaign-photo-index pointer-events-none absolute bottom-5 start-5 font-mono text-[10px] tracking-[0.25em]" dir="ltr">
              PUSH / PROGRESS / REPEAT
            </p>
          </div>
          <div className="esi-campaign-side-tag absolute bottom-[13%] end-[-3%] flex items-center gap-2 px-3 py-2.5 text-[11px] font-semibold sm:end-[-1%]">
            <span className="inline-block size-2 rounded-full bg-[var(--hero-orange)]" aria-hidden="true" />
            حرکت رو شروع کن
          </div>
          <span className="esi-campaign-photo-corner pointer-events-none absolute right-0 top-0" aria-hidden="true" />
        </motion.div>
      </div>

      <div className="relative z-10 border-y border-[var(--hero-hairline)] bg-[var(--hero-strip)]">
        <ul className="mx-auto grid max-w-7xl grid-cols-1 gap-0 px-5 sm:grid-cols-3 sm:px-8 lg:px-10">
          {strengths.map(({ label, Icon }, index) => (
            <li
              key={label}
              className="flex min-h-16 items-center gap-3 border-b border-[var(--hero-hairline)] py-3 last:border-b-0 sm:min-h-19 sm:border-b-0 sm:py-4"
            >
              <Icon size={20} strokeWidth={1.7} className="shrink-0 text-[var(--hero-orange)]" aria-hidden="true" />
              <span className="text-xs font-semibold text-[var(--hero-text)] sm:text-[13px]">{label}</span>
              <span className="ms-auto font-mono text-[11px] text-[var(--hero-faint)]" dir="ltr">
                0{index + 1}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
