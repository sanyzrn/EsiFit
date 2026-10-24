"use client";

import * as React from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { toPersianDigits } from "@/lib/formatting/numbers";

/**
 * A day with the app, as a real sequence — so the numbered markers earn their place.
 * The spine fills as the section scrolls past; each step wakes when it reaches the
 * middle of the viewport.
 */

const STEPS = [
  {
    time: "۰۷:۳۰",
    title: "صبح: ببین چقدر آماده‌ای",
    text: "با توجه به خواب و تمرین‌های اخیرت، ببین امروز بهتر است چقدر تمرین کنی.",
  },
  {
    time: "۱۸:۰۰",
    title: "عصر: ست‌هایت را ثبت کن",
    text: "وزنه و تکرار هر ست را ثبت کن. رکوردهای جدید مشخص می‌شوند و اگر دردی گزارش کرده باشی، حرکت جایگزین پیشنهاد می‌شود.",
  },
  {
    time: "۲۱:۰۰",
    title: "شب: غذاهای امروزت را ثبت کن",
    text: "غذاهایی که خورده‌ای را ثبت کن و ببین چقدر به هدف کالری و پروتئین روزانه‌ات نزدیک شده‌ای.",
  },
  {
    time: "جمعه",
    title: "آخر هفته: پیشرفتت را ببین",
    text: "خلاصه تمرین‌هایت را ببین: چه چیزی بهتر شده و هفته بعد روی چه چیزی تمرکز کنی.",
  },
];

export function DayFlow() {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 60%"] });
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.3 });
  const scaleY = useTransform(fill, [0, 1], [0, 1]);

  return (
    <div ref={ref} className="relative mt-14 max-w-3xl">
      {/* spine */}
      <div aria-hidden className="absolute inset-y-2 start-[27px] w-px bg-border">
        <motion.div
          className="absolute inset-0 origin-top bg-primary"
          style={reduce ? undefined : { scaleY }}
        />
      </div>
      <ol className="space-y-12">
        {STEPS.map((s, i) => (
          <motion.li
            key={s.time}
            className="relative flex items-start gap-5 ps-20"
            initial={reduce ? false : { opacity: 0.4, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ margin: "-35% 0px -35% 0px", once: false }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="min-w-0">
              <p className="font-display text-4xl lg:text-5xl leading-none text-primary tabular-nums">{s.time}</p>
              <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 max-w-xl text-sm leading-7 text-esi-text-secondary">{s.text}</p>
            </div>
            <span
              className="absolute start-0 top-0 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface-1 font-display text-xl shadow-[var(--shadow-rest)]"
              aria-hidden
            >
              {toPersianDigits(i + 1)}
            </span>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
