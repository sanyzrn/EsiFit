"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { RadialGauge } from "@/components/data-viz/radial-gauge";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { api, errorMessage } from "@/lib/client/api";
import { useSession } from "@/lib/client/use-session";
import { useFeatureFlag } from "@/lib/feature-flags/flag-provider";
import { parseLocaleNumber, formatNumber, toPersianDigits, toLatinDigits } from "@/lib/formatting/numbers";
import {
  bmi, bmiCategory, BMI_FA, bmrMifflinStJeor, tdee, computeMacroTargets, oneRepMax,
  oneRepMaxTable, idealWeightRange, whtr, whtrCategory, WHTR_FA, dailyWaterMl, ageFromBirthYear,
  healthyWeightRange, type ActivityLevel, type PrimaryGoal, type SexAtBirth,
} from "@/lib/domain/body-math";
import { cn } from "@/lib/utils";
import type { CalculatorField } from "./registry";

/**
 * CalculatorRunner — result-before-scroll (DESIGN_BIBLE §8).
 * Live computation as inputs change; anonymous results always visible.
 * Members can save results to history (server-verified).
 */

type CalcResult = {
  headline: string;
  headlineValue: string;
  gauge?: { value: number; min: number; max: number; tone: "primary" | "blue" | "amber" | "red" | "violet"; label: string };
  rows: Array<{ label: string; value: string; tone?: "primary" | "blue" | "amber" | "red" }>;
  table?: { title: string; headers: string[]; rows: string[][] };
};

function compute(slug: string, v: Record<string, string>): CalcResult | null {
  const num = (k: string) => parseLocaleNumber(v[k] ?? "");
  const sex = (v.sex ?? "male") as SexAtBirth;

  switch (slug) {
    case "bmi": {
      const w = num("weightKg");
      const h = num("heightCm");
      if (!w || !h) return null;
      const value = bmi(w, h);
      const cat = bmiCategory(value);
      const tone = cat === "normal" ? "primary" : cat === "underweight" ? "blue" : cat === "overweight" ? "amber" : "red";
      const range = healthyWeightRange(h);
      return {
        headline: "شاخص توده بدنی شما",
        headlineValue: formatNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
        gauge: { value, min: 12, max: 40, tone: tone as CalcResult["gauge"] extends undefined ? never : "primary", label: BMI_FA[cat] },
        rows: [
          { label: "دسته‌بندی", value: BMI_FA[cat], tone: tone as "primary" },
          { label: "بازه سالم برای قد شما", value: `${formatNumber(range.min)} تا ${formatNumber(range.max)} کیلوگرم` },
        ],
      };
    }
    case "tdee": {
      const year = num("birthYear");
      const w = num("weightKg");
      const h = num("heightCm");
      if (!year || !w || !h) return null;
      const age = ageFromBirthYear(year);
      const bmr = bmrMifflinStJeor({ sex, age, heightCm: h, weightKg: w });
      const total = tdee({ sex, age, heightCm: h, weightKg: w, activityLevel: (v.activityLevel ?? "moderate") as ActivityLevel });
      return {
        headline: "انرژی روزانه شما",
        headlineValue: `${formatNumber(total)} kcal`,
        gauge: { value: total, min: 0, max: 4000, tone: "primary", label: "TDEE" },
        rows: [
          { label: "متابولیسم پایه (BMR)", value: `${formatNumber(bmr)} کیلوکالری`, tone: "blue" },
          { label: "کالری حفظ وزن", value: `${formatNumber(total)} کیلوکالری`, tone: "primary" },
          { label: "برای کاهش وزن (−۲۰٪)", value: `${formatNumber(Math.round(total * 0.8))} کیلوکالری`, tone: "amber" },
          { label: "برای عضله‌سازی (+۱۰٪)", value: `${formatNumber(Math.round(total * 1.1))} کیلوکالری`, tone: "blue" },
        ],
      };
    }
    case "macros": {
      const year = num("birthYear");
      const w = num("weightKg");
      const h = num("heightCm");
      if (!year || !w || !h) return null;
      const m = computeMacroTargets({
        sex, birthYear: year, heightCm: h, weightKg: w,
        activityLevel: (v.activityLevel ?? "moderate") as ActivityLevel,
        goal: (v.goal ?? "build_muscle") as PrimaryGoal,
      });
      return {
        headline: "هدف روزانه شما",
        headlineValue: `${formatNumber(m.calories)} kcal`,
        rows: [
          { label: "پروتئین", value: `${formatNumber(m.proteinG)} گرم`, tone: "blue" },
          { label: "کربوهیدرات", value: `${formatNumber(m.carbsG)} گرم`, tone: "amber" },
          { label: "چربی", value: `${formatNumber(m.fatG)} گرم`, tone: "violet" as "primary" },
          { label: "فیبر", value: `${formatNumber(m.fiberG)} گرم` },
          { label: "استراتژی", value: m.strategyLabel },
        ],
      };
    }
    case "one-rep-max": {
      const w = num("weightKg");
      const r = num("reps");
      if (!w || !r) return null;
      const { epley, brzycki, recommended } = oneRepMax(w, r);
      const table = oneRepMaxTable(recommended);
      return {
        headline: "یک تکرار بیشینه تخمینی",
        headlineValue: `${formatNumber(recommended, { maximumFractionDigits: 1 })} کیلوگرم`,
        rows: [
          { label: "فرمول اپلی", value: `${formatNumber(epley, { maximumFractionDigits: 1 })} کیلوگرم`, tone: "blue" },
          { label: "فرمول بژیتکی", value: `${formatNumber(brzycki, { maximumFractionDigits: 1 })} کیلوگرم`, tone: "blue" },
        ],
        table: {
          title: "جدول درصدی برای برنامه‌ریزی",
          headers: ["درصد 1RM", "تکرار", "وزن پیشنهادی"],
          rows: table.map((t) => [`${toPersianDigits(t.pct)}٪`, toPersianDigits(t.reps), `${formatNumber(t.weight, { maximumFractionDigits: 1 })} کیلو`]),
        },
      };
    }
    case "ideal-weight": {
      const h = num("heightCm");
      if (!h) return null;
      const r = idealWeightRange(h, sex);
      const range = healthyWeightRange(h);
      return {
        headline: "بازه وزن ایده‌آل شما",
        headlineValue: `${formatNumber(r.min)} تا ${formatNumber(r.max)} کیلوگرم`,
        rows: [
          { label: `فرمول ${r.formulaLabel}`, value: `${formatNumber(r.min)} تا ${formatNumber(r.max)} کیلوگرم`, tone: "primary" },
          { label: "بازه سالم BMI", value: `${formatNumber(range.min)} تا ${formatNumber(range.max)} کیلوگرم`, tone: "blue" },
        ],
      };
    }
    case "whtr": {
      const waist = num("waistCm");
      const h = num("heightCm");
      if (!waist || !h) return null;
      const value = whtr(waist, h);
      const cat = whtrCategory(value);
      const tone = cat === "healthy" ? "primary" : cat === "slim" ? "blue" : cat === "elevated" ? "amber" : "red";
      return {
        headline: "نسبت کمر به قد",
        headlineValue: formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        gauge: { value: value * 100, min: 30, max: 70, tone: tone as "primary", label: WHTR_FA[cat] },
        rows: [
          { label: "وضعیت", value: WHTR_FA[cat], tone: tone as "primary" },
          { label: "محدوده سالم", value: "۰٫۴۰ تا ۰٫۴۹" },
        ],
      };
    }
    case "water": {
      const w = num("weightKg");
      const t = num("trainingMinutes") ?? 0;
      if (!w) return null;
      const ml = dailyWaterMl(w, t);
      return {
        headline: "هدف آبرسانی روزانه",
        headlineValue: `${formatNumber(ml / 1000, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} لیتر`,
        rows: [
          { label: "معادل لیوان ۲۵۰ میلی‌لیتری", value: `${formatNumber(Math.round(ml / 250))} لیوان`, tone: "blue" },
          { label: "پایه (بدون تمرین)", value: `${formatNumber(Math.round(w * 33 / 100) * 100 / 1000, { maximumFractionDigits: 1 })} لیتر` },
        ],
      };
    }
    case "body-fat-navy": {
      const h = num("heightCm");
      const neck = num("neckCm");
      const waist = num("waistCm");
      const hip = num("hipCm") ?? 0;
      if (!h || !neck || !waist) return null;
      let bf: number | null = null;
      if (sex === "male" && waist > neck) {
        bf = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(h)) - 450;
      } else if (sex === "female" && waist + hip > neck) {
        bf = 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.221 * Math.log10(h)) - 450;
      }
      if (bf == null || !Number.isFinite(bf) || bf < 3 || bf > 60) {
        return { headline: "درصد چربی بدن", headlineValue: "—", rows: [{ label: "وضعیت", value: "دوره‌های واردشده معتبر نیستند" }] };
      }
      const value = Math.round(bf * 10) / 10;
      const tone = value < 18 ? "primary" : value < 25 ? "blue" : value < 32 ? "amber" : "red";
      return {
        headline: "درصد چربی بدن تخمینی",
        headlineValue: `${formatNumber(value, { minimumFractionDigits: 1 })}٪`,
        gauge: { value, min: 3, max: 50, tone: tone as "primary", label: "چربی بدن" },
        rows: [
          { label: "دسته‌بندی تقریبی", value: value < 18 ? "ورزشکاری" : value < 25 ? "تناسب" : value < 32 ? "متوسط" : "بالا", tone: tone as "primary" },
        ],
      };
    }
    default:
      return null;
  }
}

export function CalculatorRunner({
  slug,
  inputs,
  disclaimer,
  methodNote,
}: {
  slug: string;
  inputs: CalculatorField[];
  disclaimer: string;
  methodNote: string;
}) {
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      inputs.map((f) => [f.key, f.defaultValue != null ? (typeof f.defaultValue === "number" ? String(f.defaultValue) : f.defaultValue) : ""]),
    ),
  );
  const [saved, setSaved] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const session = useSession();
  const calculatorsFlag = useFeatureFlag("CALCULATORS");
  const reduced = useReducedMotion();

  if (!calculatorsFlag) {
    return <p className="px-4 py-10 text-center text-sm text-esi-text-muted">این بخش در دسترس نیست.</p>;
  }

  const result = compute(slug, values);
  const filled = inputs.every((f) => values[f.key]?.trim() !== "");

  const save = async () => {
    setSaveError(null);
    try {
      await api("/api/calculators/results", {
        method: "POST",
        json: {
          calculatorType: slug,
          calculatorVersion: "v1",
          inputs: values,
          result: result ? { headline: result.headlineValue, rows: result.rows } : {},
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveError(errorMessage(e));
    }
  };

  return (
    <div className="px-4 lg:px-8 pb-10 max-w-4xl mx-auto w-full">
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        {/* inputs */}
        <section aria-label="ورودی‌ها" className="rounded-3xl border border-border bg-surface-1 p-6 space-y-4 h-fit">
          {inputs.map((f) => (
            <div key={f.key}>
              <label htmlFor={`calc-${f.key}`} className="block text-sm font-medium mb-1.5">
                {f.label}
                {f.unit && <span className="text-esi-text-muted font-normal"> ({f.unit})</span>}
              </label>
              {f.hint && <p className="mb-2 text-[11px] text-esi-text-muted">{f.hint}</p>}
              {f.type === "select" ? (
                <select
                  id={`calc-${f.key}`}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none focus:border-primary transition-colors"
                >
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  id={`calc-${f.key}`}
                  type="text"
                  inputMode="decimal"
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  className="h-12 w-full rounded-xl border border-border bg-surface-2 px-4 text-lg tabular-nums outline-none focus:border-primary transition-colors placeholder:text-esi-text-muted/60"
                />
              )}
            </div>
          ))}
        </section>

        {/* result — visible before scroll */}
        <section aria-label="نتیجه" className="rounded-3xl border border-primary/25 bg-surface-1 p-6 relative overflow-hidden min-h-[280px]">
          <div aria-hidden className="absolute -top-16 -end-16 h-44 w-44 rounded-full bg-mint-400/8 blur-3xl" />
          {!filled || !result ? (
            <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center gap-3">
              <span className="text-4xl opacity-60" aria-hidden>🧮</span>
              <p className="text-sm text-esi-text-secondary max-w-[240px]">
                همه مقادیر را وارد کنید — نتیجه همان لحظه و بدون ثبت‌نام محاسبه می‌شود.
              </p>
            </div>
          ) : (
            <motion.div
              key={result.headlineValue}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-xs font-semibold text-primary">{result.headline}</p>
              <p className="mt-2 text-4xl font-extrabold tabular-nums tracking-tight">
                <AnimatedCounter
                  value={parseLocaleNumber(result.headlineValue) ?? 0}
                  format="decimal"
                  digits={1}
                />
                <span className="text-base font-medium text-esi-text-muted ms-2">
                  {result.headlineValue.replace(/[\d.,٫\-۰-۹]/g, "").trim()}
                </span>
              </p>

              {result.gauge && (
                <div className="mt-4 flex justify-center">
                  <RadialGauge
                    value={result.gauge.value}
                    min={result.gauge.min}
                    max={result.gauge.max}
                    tone={result.gauge.tone}
                    size={140}
                    label={result.gauge.label}
                  />
                </div>
              )}

              <dl className="mt-5 space-y-2.5">
                {result.rows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-2.5">
                    <dt className="text-xs text-esi-text-secondary">{row.label}</dt>
                    <dd className={cn(
                      "text-sm font-bold tabular-nums",
                      row.tone === "primary" && "text-primary",
                      row.tone === "blue" && "text-blue-400",
                      row.tone === "amber" && "text-amber-400",
                      row.tone === "red" && "text-red-400",
                    )}>
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>

              {result.table && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-esi-text-secondary mb-2">{result.table.title}</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-esi-text-muted">
                        {result.table.headers.map((h) => <th key={h} className="py-1.5 text-start font-medium">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {result.table.rows.map((r, i) => (
                        <tr key={i} className="border-t border-border">
                          {r.map((cell, j) => <td key={j} className="py-1.5 tabular-nums">{cell}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}
        </section>
      </div>

      {/* method + disclaimer + save */}
      <div className="mt-5 space-y-3">
        <div className="rounded-2xl border border-border bg-surface-1 p-4">
          <p className="text-xs font-semibold text-esi-text-secondary mb-1">روش محاسبه</p>
          <p className="text-xs leading-6 text-esi-text-muted">{methodNote}</p>
        </div>
        <p className="text-[11px] leading-5 text-esi-text-muted flex gap-2">
          <Icon name="Info" size={14} className="shrink-0 mt-0.5" />
          {disclaimer}
        </p>

        {session && result && filled && (
          <div className="flex items-center gap-3">
            <Button variant="secondary" className="h-10" onClick={() => void save()}>
              <Icon name="BookmarkPlus" size={16} />
              ذخیره نتیجه در تاریخچه
            </Button>
            {saved && <span role="status" className="text-xs text-primary">ذخیره شد ✓</span>}
            {saveError && <span role="alert" className="text-xs text-destructive">{saveError}</span>}
          </div>
        )}
        {!session && result && filled && (
          <p className="text-xs text-esi-text-muted">
            <a href="/auth/login" className="text-primary font-medium">وارد شوید</a> تا نتایج در تاریخچه ذخیره شود و با مقایسه روند ببینید.
          </p>
        )}
      </div>
    </div>
  );
}
