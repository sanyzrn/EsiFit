/** Pure calculator equations, separated from display for regression testing. */
import { formatNumber, toPersianDigits } from "@/lib/formatting/numbers";
import { parseCalculatorNumber } from "./validation";
import {
  bmi, bmiCategory, BMI_FA, bmrMifflinStJeor, tdee, computeMacroTargets, oneRepMax,
  oneRepMaxTable, idealWeightRange, whtr, whtrCategory, WHTR_FA, dailyWaterMl, ageFromBirthYear,
  healthyWeightRange, type ActivityLevel, type PrimaryGoal, type SexAtBirth,
} from "@/lib/domain/body-math";

export type CalcResult = {
  headline: string;
  headlineValue: string;
  gauge?: { value: number; min: number; max: number; tone: "primary" | "blue" | "amber" | "red" | "violet"; label: string };
  rows: Array<{ label: string; value: string; tone?: "primary" | "blue" | "amber" | "red" | "violet" }>;
  table?: { title: string; headers: string[]; rows: string[][] };
};

export function computeCalculator(slug: string, v: Record<string, string>): CalcResult | null {
  const num = (k: string) => parseCalculatorNumber(v[k] ?? "");
  const sex = (v.sex ?? "male") as SexAtBirth;

  switch (slug) {
    case "bmi": {
      const w = num("weightKg");
      const h = num("heightCm");
      if (!w || !h) return null;
      const value = bmi(w, h);
      const cat = bmiCategory(w / ((h / 100) ** 2));
      const tone = cat === "normal" ? "primary" : cat === "underweight" ? "blue" : cat === "overweight" ? "amber" : "red";
      const range = healthyWeightRange(h);
      return {
        headline: "شاخص توده بدنی شما",
        headlineValue: formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        gauge: { value, min: 12, max: 40, tone, label: BMI_FA[cat] },
        rows: [
          { label: "دسته‌بندی", value: BMI_FA[cat], tone },
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
        headlineValue: `${formatNumber(total)} کیلوکالری`,
        gauge: { value: total, min: 0, max: Math.max(4000, Math.ceil(total / 500) * 500), tone: "primary", label: "TDEE" },
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
        headlineValue: `${formatNumber(m.calories)} کیلوکالری`,
        rows: [
          { label: "پروتئین", value: `${formatNumber(m.proteinG)} گرم`, tone: "blue" },
          { label: "کربوهیدرات", value: `${formatNumber(m.carbsG)} گرم`, tone: "amber" },
          { label: "چربی", value: `${formatNumber(m.fatG)} گرم`, tone: "violet" },
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
          ...(r <= 10 ? [{ label: "فرمول بژیتکی", value: `${formatNumber(brzycki, { maximumFractionDigits: 1 })} کیلوگرم`, tone: "blue" as const }] : []),
          ...(r > 10 ? [{ label: "دقت تخمین", value: "تکرار بالا؛ دقت کمتر" }] : []),
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
      const cat = whtrCategory(waist / h);
      const tone = cat === "healthy" ? "primary" : cat === "slim" ? "blue" : cat === "elevated" ? "amber" : "red";
      return {
        headline: "نسبت کمر به قد",
        headlineValue: formatNumber(value, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
        gauge: { value: value * 100, min: 30, max: 70, tone, label: WHTR_FA[cat] },
        rows: [
          { label: "وضعیت", value: WHTR_FA[cat], tone },
          { label: "محدوده سالم", value: "۰٫۴۰۰ تا کمتر از ۰٫۵۰۰" },
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
      // Age- and sex-specific labels need demographic inputs; do not misclassify.
      const tone = "primary" as const;
      return {
        headline: "درصد چربی بدن تخمینی",
        headlineValue: `${formatNumber(value, { minimumFractionDigits: 1 })}٪`,
        gauge: { value, min: 3, max: 50, tone, label: "چربی بدن" },
        rows: [
          { label: "روش", value: "تخمین از اندازه‌های بدن", tone },
        ],
      };
    }
    default:
      return null;
  }
}

