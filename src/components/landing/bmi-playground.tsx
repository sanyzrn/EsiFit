"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { bmi, bmiCategory, BMI_FA, healthyWeightRange, type BmiCategory } from "@/lib/domain/body-math";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { Button } from "@/components/ui/button";
import { toPersianDigits } from "@/lib/formatting/numbers";

/**
 * Try-before-signup: the same BMI maths the calculators use, live on the landing
 * page. Nothing is stored — the result moves as the sliders do.
 */

const BANDS: Array<{ key: BmiCategory; from: number; to: number; color: string }> = [
  { key: "underweight", from: 14, to: 18.5, color: "var(--lapis)" },
  { key: "normal", from: 18.5, to: 25, color: "var(--turquoise)" },
  { key: "overweight", from: 25, to: 30, color: "var(--ember)" },
  { key: "obese", from: 30, to: 40, color: "var(--coral)" },
];
const MIN = 14;
const MAX = 40;

const NOTE: Record<BmiCategory, string> = {
  underweight: "کمی پایین‌تر از محدوده سالم. تغذیه کافی و تمرین قدرتی می‌تواند کمک کند.",
  normal: "در محدوده سالم هستید. هدف اصلی می‌تواند ترکیب بدنی و قدرت باشد، نه عدد ترازو.",
  overweight: "کمی بالاتر از محدوده سالم. BMI عضله و چربی را جدا نمی‌کند — ترکیب بدنی را هم ببینید.",
  obese: "بالاتر از محدوده سالم. شروع تدریجی با پیاده‌روی و تمرین مقاومتی انتخاب خوبی است.",
};

function Slider({
  id,
  label,
  unit,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm text-esi-text-secondary">
          {label}
        </label>
        <span className="font-display text-3xl tabular-nums leading-none">
          {toPersianDigits(value)}
          <span className="ms-1 text-xs text-esi-text-muted font-sans">{unit}</span>
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        dir="rtl"
        className="esi-range w-full"
        style={{ "--pct": `${pct}%` } as React.CSSProperties}
      />
    </div>
  );
}

export function BmiPlayground() {
  const reduce = useReducedMotion();
  const [height, setHeight] = React.useState(175);
  const [weight, setWeight] = React.useState(76);
  const value = bmi(weight, height);
  const cat = bmiCategory(value);
  const range = healthyWeightRange(height);
  const pos = Math.min(100, Math.max(0, ((value - MIN) / (MAX - MIN)) * 100));
  const band = BANDS.find((b) => b.key === cat)!;

  return (
    <div className="esi-card rounded-3xl p-6 lg:p-8">
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="space-y-8">
          <Slider id="bmi-height" label="قد" unit="سانتی‌متر" value={height} min={140} max={210} onChange={setHeight} />
          <Slider id="bmi-weight" label="وزن" unit="کیلوگرم" value={weight} min={40} max={150} onChange={setWeight} />
        </div>

        <div aria-live="polite">
          <p className="text-sm text-esi-text-secondary">شاخص توده بدنی (BMI)</p>
          <p className="mt-1 flex items-end gap-3">
            <span className="font-display text-7xl leading-none tabular-nums" style={{ color: band.color }}>
              <AnimatedCounter value={value} format="decimal" digits={1} duration={0.35} />
            </span>
            <span className="pb-2 text-lg font-bold" style={{ color: band.color }}>
              {BMI_FA[cat]}
            </span>
          </p>

          {/* band bar with a spring-loaded marker */}
          <div className="relative mt-6 pt-3">
            <div className="flex h-2.5 overflow-hidden rounded-full" aria-hidden>
              {BANDS.map((b) => (
                <span
                  key={b.key}
                  style={{ width: `${((b.to - b.from) / (MAX - MIN)) * 100}%`, background: b.color, opacity: b.key === cat ? 1 : 0.35 }}
                  className="transition-opacity duration-300"
                />
              ))}
            </div>
            <motion.span
              aria-hidden
              className="absolute top-0 h-6 w-1 rounded-full bg-esi-text-primary shadow-[0_0_10px_var(--text-primary)]"
              style={{ right: `${pos}%`, translateX: "50%" }}
              animate={{ right: `${pos}%` }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 22 }}
            />
          </div>

          <p className="mt-5 text-sm leading-7 text-esi-text-secondary">{NOTE[cat]}</p>
          <p className="mt-2 text-xs text-esi-text-muted">
            محدوده وزن سالم برای قد {toPersianDigits(height)}: {toPersianDigits(range.min)} تا {toPersianDigits(range.max)} کیلوگرم
          </p>
          <Button asChild variant="secondary" className="mt-6">
            <Link href="/calculators">هشت ماشین‌حساب کامل</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
