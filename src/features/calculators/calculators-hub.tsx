"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";

const CALCULATORS = [
  { slug: "bmi", emoji: "⚖️", name: "شاخص توده بدنی (BMI)", desc: "وضعیت وزن نسبت به قد بر اساس استاندارد WHO" },
  { slug: "tdee", emoji: "🔥", name: "کالری روزانه (TDEE)", desc: "متابولیسم پایه و کل انرژی با فرمول میفلین-سن‌جور" },
  { slug: "macros", emoji: "🥗", name: "پروتئین و ماکرو", desc: "کالری، پروتئین، کربوهیدرات و چربی بر اساس هدف" },
  { slug: "one-rep-max", emoji: "🏋️", name: "یک تکرار بیشینه (1RM)", desc: "تخمین امن با فرمول‌های اپلی و بژیتکی + جدول درصدی" },
  { slug: "ideal-weight", emoji: "🎯", name: "وزن ایده‌آل", desc: "بازه پیشنهادی با فرمول‌های دیواین و رابینسون" },
  { slug: "whtr", emoji: "📏", name: "نسبت دور کمر به قد", desc: "شاخص توزیع چربی شکمی — قوی‌تر از BMI برای ریسک" },
  { slug: "water", emoji: "💧", name: "آب روزانه", desc: "نیاز آبرسانی بر اساس وزن و حجم تمرین" },
  { slug: "body-fat-navy", emoji: "📊", name: "درصد چربی بدن", desc: "روش اندازه‌گیری دورهای بدن (ازままند ارتش آمریکا)" },
];

export function CalculatorsHub() {
  return (
    <div className="px-4 lg:px-8 pb-8 max-w-5xl mx-auto w-full">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CALCULATORS.map((c) => (
          <Link
            key={c.slug}
            href={`/calculators/${c.slug}`}
            className="group rounded-3xl border border-border bg-surface-1 p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-raised)]"
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-2xl" aria-hidden>
              {c.emoji}
            </span>
            <h2 className="mt-4 font-bold group-hover:text-primary transition-colors">{c.name}</h2>
            <p className="mt-1.5 text-[13px] leading-6 text-esi-text-secondary">{c.desc}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs text-primary">
              محاسبه کن
              <Icon name="ChevronLeft" size={14} className="transition-transform group-hover:-translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
