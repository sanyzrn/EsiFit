"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { KhatamDial } from "@/components/motion/khatam";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { MuscleBody } from "@/components/data-viz/anatomy/muscle-body";
import { RevealOnScroll } from "@/components/ui/reveal-on-scroll";
import { toPersianDigits } from "@/lib/formatting/numbers";
import { cn } from "@/lib/utils";

/**
 * Feature bento: each tile demonstrates its feature with a small live motion
 * study instead of an icon + paragraph. Sizes differ on purpose — the live
 * workout log is the product's heart, so it gets the biggest tile.
 */

function Tile({
  title,
  text,
  className,
  delay = 0,
  children,
}: {
  title: string;
  text: string;
  className?: string;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <RevealOnScroll delay={delay} className={className}>
      <article className="esi-card esi-card-lift group flex h-full flex-col overflow-hidden rounded-3xl p-6 lg:p-7">
        <div className="relative mb-5 flex-1 min-h-44">{children}</div>
        <h3 className="font-display text-2xl leading-tight">{title}</h3>
        <p className="mt-2 text-sm leading-7 text-esi-text-secondary">{text}</p>
      </article>
    </RevealOnScroll>
  );
}

/* ---------- live workout: sets tick in, rest ring drains ---------- */
const SETS = [
  { w: 80, r: 8 },
  { w: 82.5, r: 8 },
  { w: 85, r: 6 },
];

function LiveLogStudy() {
  const reduce = useReducedMotion();
  return (
    <div className="flex h-full flex-col justify-center gap-2.5" aria-hidden>
      {SETS.map((s, i) => (
        <motion.div
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2/80 px-4 py-3"
          initial={reduce ? false : { opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.25 + i * 0.35, type: "spring", stiffness: 240, damping: 22 }}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-3 text-xs font-bold text-esi-text-secondary tabular-nums">
            {toPersianDigits(i + 1)}
          </span>
          <span className="font-display text-xl tabular-nums">{toPersianDigits(s.w)}</span>
          <span className="text-xs text-esi-text-muted">کیلو ×</span>
          <span className="font-display text-xl tabular-nums">{toPersianDigits(s.r)}</span>
          <motion.span
            className="ms-auto flex h-7 w-7 items-center justify-center rounded-full bg-turquoise/15 text-turquoise"
            initial={reduce ? false : { scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6 + i * 0.35, type: "spring", stiffness: 420, damping: 14 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.span>
        </motion.div>
      ))}
      <div className="mt-1 flex items-center gap-3 px-1 text-xs text-esi-text-muted">
        <span className="relative inline-flex h-6 w-6">
          <svg viewBox="0 0 24 24" className="h-6 w-6 -rotate-90">
            <circle cx="12" cy="12" r="9" fill="none" stroke="var(--surface-3)" strokeWidth="3" />
            <motion.circle
              cx="12" cy="12" r="9" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round"
              strokeDasharray={56.5}
              initial={{ strokeDashoffset: 0 }}
              animate={reduce ? undefined : { strokeDashoffset: [0, 56.5] }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            />
          </svg>
        </span>
        استراحت {toPersianDigits(90)} ثانیه — ست بعدی آماده است
      </div>
    </div>
  );
}

/* ---------- nutrition: three macro rings filling ---------- */
function MacroStudy() {
  const reduce = useReducedMotion();
  const rings = [
    { label: "پروتئین", pct: 0.82, color: "var(--lapis)" },
    { label: "کربوهیدرات", pct: 0.64, color: "var(--turquoise)" },
    { label: "چربی", pct: 0.47, color: "var(--iris)" },
  ];
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex h-full flex-col justify-center gap-5" aria-hidden>
      <div className="flex items-center justify-around">
        {rings.map((ring, i) => (
          <div key={ring.label} className="text-center">
            <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
              <circle cx="36" cy="36" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="7" />
              <motion.circle
                cx="36" cy="36" r={r} fill="none" stroke={ring.color} strokeWidth="7" strokeLinecap="round"
                strokeDasharray={c}
                initial={{ strokeDashoffset: reduce ? c * (1 - ring.pct) : c }}
                whileInView={{ strokeDashoffset: c * (1 - ring.pct) }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, delay: 0.2 + i * 0.2, ease: [0.22, 1, 0.36, 1] }}
              />
            </svg>
            <p className="mt-1 text-[11px] text-esi-text-muted">{ring.label}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {["چلوکباب برگ", "عدسی", "ماست و خیار"].map((f) => (
          <span key={f} className="rounded-full border border-border bg-surface-2 px-3 py-1 text-[11px] text-esi-text-secondary">
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- AI: chat with a typing bubble ---------- */
function ChatStudy() {
  return (
    <div className="flex h-full flex-col justify-center gap-2.5 text-[12px] leading-6" aria-hidden>
      <div className="max-w-[85%] self-start rounded-2xl rounded-ss-md bg-surface-3 px-3.5 py-2">
        امروز خیلی خسته‌ام، تمرین سبک‌تر بزنم؟
      </div>
      <div className="max-w-[88%] self-end rounded-2xl rounded-se-md bg-primary px-3.5 py-2 text-primary-foreground">
        امتیاز آمادگی‌ات ۶۲ است. امروز ۲۰٪ کمتر تمرین کن و روی اجرای درست حرکت‌ها تمرکز کن.
      </div>
      <div className="flex w-14 items-center justify-center gap-1 self-start rounded-2xl bg-surface-3 py-2.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="esi-twinkle h-1.5 w-1.5 rounded-full bg-esi-text-muted" style={{ "--i": i * 0.3 } as React.CSSProperties} />
        ))}
      </div>
    </div>
  );
}

/* ---------- gamification: XP bar + badges ---------- */
function XpStudy() {
  const reduce = useReducedMotion();
  return (
    <div className="flex h-full flex-col justify-center gap-4" aria-hidden>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-esi-text-muted">سطح</p>
          <p className="font-display text-5xl leading-none tabular-nums">{toPersianDigits(11)}</p>
        </div>
        <p className="text-xs text-esi-text-secondary tabular-nums">
          <AnimatedCounter value={1240} /> از {toPersianDigits(1500)} امتیاز
        </p>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-surface-3">
        <motion.div
          className="esi-gradient-brand h-full rounded-full"
          initial={{ width: reduce ? "83%" : 0 }}
          whileInView={{ width: "83%" }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <div className="flex gap-2">
        {["🏆", "🔥", "💪", "⚡", "🥇"].map((b, i) => (
          <motion.span
            key={i}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-surface-2 text-xl",
              i > 2 && "opacity-35 grayscale",
            )}
            initial={reduce ? false : { scale: 0, rotate: -20 }}
            whileInView={{ scale: 1, rotate: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 + i * 0.1, type: "spring", stiffness: 360, damping: 16 }}
          >
            {b}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

/* ---------- offline: queue drains when the signal returns ---------- */
function OfflineStudy() {
  const reduce = useReducedMotion();
  return (
    <div className="flex h-full items-center justify-center gap-6" aria-hidden>
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-2.5 w-24 rounded-full bg-primary/80"
            animate={reduce ? undefined : { x: [0, 0, -70, -70], opacity: [1, 1, 0, 0] }}
            transition={{ duration: 3.6, repeat: Infinity, delay: i * 0.25, times: [0, 0.5, 0.8, 1], ease: "easeInOut" }}
          />
        ))}
      </div>
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface-2 text-turquoise">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 18a4 4 0 0 1-.6-7.96A6 6 0 0 1 18 9a4.5 4.5 0 0 1 .5 9z" />
          <path d="M12 12v5M9.5 14.5 12 12l2.5 2.5" />
        </svg>
        <span className="esi-pulse absolute inset-0 rounded-2xl" />
      </div>
    </div>
  );
}

const SAMPLE_HEAT = { chest: 88, front_delts: 70, triceps: 64, quads: 40, abs: 28, lats: 76, biceps: 52 };

export function FeatureBento() {
  return (
    <div className="mt-12 grid gap-5 lg:grid-cols-12">
      <Tile
        className="lg:col-span-7"
        title="ثبت تمرین، همان موقع"
        text="وزنه و تکرار هر ست را همان موقع ثبت کن و زمان استراحتت را ببین. اگر اینترنت قطع شود، تمرینت ذخیره می‌ماند."
      >
        <LiveLogStudy />
      </Tile>
      <Tile
        className="lg:col-span-5"
        delay={0.06}
        title="آمادگی امروزت"
        text="با توجه به خواب و تمرین‌های اخیرت، ببین امروز چقدر آماده‌ای و چه عواملی روی آن اثر گذاشته‌اند."
      >
        <div className="flex h-full items-center justify-center">
          <KhatamDial value={78} size={190} color="var(--turquoise)" label="نمونه امتیاز آمادگی ۷۸">
            <span className="font-display text-5xl leading-none tabular-nums">
              <AnimatedCounter value={78} duration={1.4} />
            </span>
          </KhatamDial>
        </div>
      </Tile>
      <Tile
        className="lg:col-span-4"
        delay={0.04}
        title="ثبت آسان غذاهای ایرانی"
        text="از عدسی تا چلوکباب، غذایت را ثبت کن و میزان پروتئین، کربوهیدرات و چربی روزانه را ببین."
      >
        <MacroStudy />
      </Tile>
      <Tile
        className="lg:col-span-4"
        delay={0.1}
        title="نقشه حرارتی عضلات"
        text="روی تصویر بدن ببین در ۳۰ روز گذشته کدام عضله‌ها را بیشتر تمرین داده‌ای."
      >
        <div className="flex h-full items-center justify-center">
          <MuscleBody mode="display" intensity={SAMPLE_HEAT} height={190} ariaLabel="نمونه نقشه حرارتی عضلات" />
        </div>
      </Tile>
      <Tile
        className="lg:col-span-4"
        delay={0.16}
        title="دستیار هوشمند"
        text="درباره حرکت‌ها، برنامه تمرین و تغذیه سؤال بپرس و راهنمایی بگیر."
      >
        <ChatStudy />
      </Tile>
      <Tile
        className="lg:col-span-6"
        delay={0.04}
        title="تمرین کن، امتیاز بگیر"
        text="با تمرین و انجام کارهای روزانه امتیاز جمع کن، نشان بگیر و پیشرفتت را ببین."
      >
        <XpStudy />
      </Tile>
      <Tile
        className="lg:col-span-6"
        delay={0.1}
        title="تمرین بدون نگرانی از اینترنت"
        text="تمرین‌هایت روی گوشی ذخیره می‌شوند و وقتی اینترنت وصل شد، خودکار به‌روز می‌شوند."
      >
        <OfflineStudy />
      </Tile>
    </div>
  );
}
