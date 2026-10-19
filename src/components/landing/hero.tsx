"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "framer-motion";
import { Button } from "@/components/ui/button";
import { KhatamDial, KhatamStar } from "@/components/motion/khatam";
import { Magnetic } from "@/components/motion/magnetic";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { toPersianDigits } from "@/lib/formatting/numbers";

/**
 * Landing hero. One orchestrated moment: the headline lifts out of its masks,
 * the khatam dial ignites tick by tick, then the live-data chips drop in.
 * Pointer movement tilts the whole scene slightly; chips sit at different depths.
 */

type ChipProps = {
  mx: MotionValue<number>;
  my: MotionValue<number>;
  depth: number;
  delay: number;
  className: string;
  children: React.ReactNode;
  index: number;
};

function FloatChip({ mx, my, depth, delay, className, children, index }: ChipProps) {
  const reduce = useReducedMotion();
  const x = useTransform(mx, (v) => v * depth);
  const y = useTransform(my, (v) => v * depth);
  return (
    <motion.div style={{ x, y }} className={`absolute ${className}`}>
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.7, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: reduce ? 0 : delay, type: "spring", stiffness: 260, damping: 20 }}
      >
        <div className="esi-float esi-glass rounded-2xl border border-border px-4 py-3 shadow-[var(--shadow-float)]" style={{ "--i": index } as React.CSSProperties}>
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function LandingHero({ signedIn }: { signedIn: boolean }) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const smx = useSpring(mx, { stiffness: 90, damping: 18 });
  const smy = useSpring(my, { stiffness: 90, damping: 18 });
  const rotateY = useTransform(smx, (v) => v / -30);
  const rotateX = useTransform(smy, (v) => v / 30);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - (r.left + r.width / 2));
    my.set(e.clientY - (r.top + r.height / 2));
  };
  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <section className="relative isolate overflow-hidden esi-hero-graphite pt-28 pb-20 lg:pt-40 lg:pb-28">
      <div aria-hidden className="esi-aurora -z-10" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 [mask-image:radial-gradient(70%_70%_at_30%_40%,black,transparent)]"
      >
        <div className="esi-pattern" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 lg:px-8 grid lg:grid-cols-[1.05fr_0.95fr] gap-14 lg:gap-8 items-center">
        {/* ---------- copy ---------- */}
        <div>
          <h1 className="font-display text-[42px] sm:text-6xl lg:text-[66px] xl:text-[72px] leading-[1.25] text-esi-text-primary">
            <span className="esi-line" style={{ "--i": 0 } as React.CSSProperties}>
              <span>تمرین هوشمند،</span>
            </span>
            <span className="esi-line text-primary" style={{ "--i": 1 } as React.CSSProperties}>
              <span>پیشرفت قابل</span>
            </span>
            <span className="esi-line text-primary" style={{ "--i": 2 } as React.CSSProperties}>
              <span>اندازه‌گیری</span>
            </span>
          </h1>

          <p
            className="esi-rise mt-7 max-w-xl text-base lg:text-lg leading-8 text-esi-text-secondary"
            style={{ "--i": 4 } as React.CSSProperties}
          >
            اسی‌فیت همه‌چیز را در یک تجربه فارسی و موبایل‌پسند جمع کرده: برنامه تمرین زنده با ثبت آفلاین،
            تغذیه با غذاهای ایرانی، امتیاز آمادگی روزانه، تحلیل عضلانی و دستیار هوشمند.
          </p>

          <div className="esi-rise mt-9 flex flex-wrap items-center gap-3" style={{ "--i": 5 } as React.CSSProperties}>
            <Magnetic>
              <Button asChild size="lg" className="esi-sheen esi-glow h-14 px-8 text-base">
                <Link href={signedIn ? "/dashboard" : "/auth/login"}>
                  {signedIn ? "ادامه در داشبورد" : "شروع رایگان — فقط شماره موبایل"}
                </Link>
              </Button>
            </Magnetic>
            <Button asChild variant="secondary" size="lg" className="h-14 px-6">
              <Link href="/calculators">محاسبه شاخص‌های بدنی</Link>
            </Button>
          </div>

          <dl
            className="esi-rise mt-12 flex max-w-lg items-stretch divide-x divide-x-reverse divide-border"
            style={{ "--i": 6 } as React.CSSProperties}
          >
            {[
              { v: 94, l: "غذای ایرانی در پایگاه داده" },
              { v: 71, l: "حرکت با راهنمای فارسی" },
              { v: 8, l: "ماشین‌حساب تخصصی" },
            ].map((s, i) => (
              <div key={s.l} className={i === 0 ? "pe-6" : "px-6"}>
                <dt className="sr-only">{s.l}</dt>
                <dd className="font-display text-4xl lg:text-5xl text-esi-text-primary tabular-nums leading-none">
                  <AnimatedCounter value={s.v} duration={1.4} />
                </dd>
                <dd className="mt-2 text-[11px] leading-4 text-esi-text-muted max-w-[7.5rem]">{s.l}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ---------- scene ---------- */}
        <div
          className="relative mx-auto w-full max-w-[520px] aspect-square"
          onPointerMove={onMove}
          onPointerLeave={onLeave}
        >
          <KhatamStar size={520} strokeWidth={0.5} spin className="absolute inset-0 h-full w-full text-primary/15" />

          <motion.div
            className="absolute inset-0 flex items-center justify-center [perspective:900px]"
            style={reduce ? undefined : { rotateX, rotateY }}
          >
            <KhatamDial value={86} size={320} color="var(--primary)" label="امتیاز آمادگی ۸۶ از ۱۰۰" delay={0.7} className="max-w-[78%] max-h-[78%] aspect-square !h-auto !w-full">
              <span className="font-display text-[88px] sm:text-[104px] leading-none tabular-nums text-esi-text-primary">
                <AnimatedCounter value={86} duration={1.6} />
              </span>
              <span className="mt-1 text-sm text-turquoise">آماده تمرین</span>
            </KhatamDial>
          </motion.div>

          <FloatChip mx={smx} my={smy} depth={0.05} delay={1.9} index={0} className="top-[6%] start-[2%]">
            <p className="text-[11px] text-esi-text-muted">زنجیره فعالیت</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-bold">
              <span className="esi-flame text-lg" aria-hidden>🔥</span>
              {toPersianDigits(12)} روز
            </p>
          </FloatChip>
          <FloatChip mx={smx} my={smy} depth={0.09} delay={2.1} index={1} className="top-[30%] end-[-2%]">
            <p className="text-[11px] text-esi-text-muted">تمرین امروز</p>
            <p className="mt-0.5 text-sm font-bold">پرس و زیربغل</p>
          </FloatChip>
          <FloatChip mx={smx} my={smy} depth={0.07} delay={2.3} index={2} className="bottom-[16%] start-[-3%]">
            <p className="text-[11px] text-esi-text-muted">آب امروز</p>
            <div className="mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-surface-3">
              <motion.div
                className="h-full rounded-full bg-lapis"
                initial={{ width: 0 }}
                animate={{ width: "75%" }}
                transition={{ delay: 2.6, duration: 1, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <p className="mt-1 text-sm font-bold">{toPersianDigits(75)}٪ هدف</p>
          </FloatChip>
          <FloatChip mx={smx} my={smy} depth={0.11} delay={2.5} index={3} className="bottom-[2%] end-[8%]">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
              <span aria-hidden>✦</span> رکورد جدید
            </p>
            <p className="mt-0.5 text-sm font-bold">اسکوات {toPersianDigits(140)} کیلو</p>
          </FloatChip>
        </div>
      </div>
    </section>
  );
}
