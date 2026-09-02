/**
 * Body & energy math — established, citable formulas only.
 * - BMR: Mifflin-St Jeor (1990), the ADA-preferred equation.
 * - TDEE: standard activity multipliers (1.2 / 1.375 / 1.55 / 1.725 / 1.9).
 * - BMI: WHO definition and bands.
 * - 1RM: Epley + Brzycki averaged presentation (±5% accuracy in 2–10 rep range).
 * - WHtR: waist-to-height ratio; healthy band 0.4–0.49 (Ashwell et al.).
 * - Macro targets: evidence-based protein anchoring (1.6–2.2 g/kg),
 *   fat floor 25% energy, remainder carbohydrate.
 * All outputs are guidance, never diagnosis. Units are canonical metric.
 */

export type SexAtBirth = "female" | "male" | "intersex" | "undisclosed";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type PrimaryGoal = "lose_weight" | "build_muscle" | "endurance" | "health" | "recomp";

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const ACTIVITY_LABELS_FA: Record<ActivityLevel, string> = {
  sedentary: "کم‌تحرک (کار پشت میز)",
  light: "فعالیت سبک (۱–۳ روز تمرین)",
  moderate: "متوسط (۳–۵ روز تمرین)",
  active: "زیاد (۶–۷ روز تمرین)",
  very_active: "بسیار زیاد (تمرین حرفه‌ای یا کار بدنی)",
};

export const activityLabelFa = (level: ActivityLevel) => ACTIVITY_LABELS_FA[level];

/** Mifflin-St Jeor BMR (kcal/day). Intersex/undisclosed uses equation midpoint. */
export function bmrMifflinStJeor(input: {
  sex: SexAtBirth;
  age: number;
  heightCm: number;
  weightKg: number;
}): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  if (input.sex === "male") return Math.round(base + 5);
  if (input.sex === "female") return Math.round(base - 161);
  return Math.round(base - 78); // midpoint
}

/** Age from birth year — accepts Jalali (1300–1420) or Gregorian years. */
export function ageFromBirthYear(birthYear: number): number {
  const nowGy = new Date().getUTCFullYear();
  const nowJy = nowGy - 621;
  const isJalaliYear = birthYear >= 1300 && birthYear <= 1420;
  const age = isJalaliYear ? nowJy - birthYear : nowGy - birthYear;
  return Math.min(Math.max(age, 10), 100);
}

/** TDEE = BMR × activity multiplier. */
export function tdee(input: {
  sex: SexAtBirth;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
}): number {
  return Math.round(bmrMifflinStJeor(input) * ACTIVITY_MULTIPLIERS[input.activityLevel]);
}

export type BmiCategory = "underweight" | "normal" | "overweight" | "obese";

export function bmi(weightKg: number, heightCm: number): number {
  const h = heightCm / 100;
  if (h <= 0) return 0;
  return Math.round((weightKg / (h * h)) * 10) / 10;
}

export function bmiCategory(value: number): BmiCategory {
  if (value < 18.5) return "underweight";
  if (value < 25) return "normal";
  if (value < 30) return "overweight";
  return "obese";
}

export const BMI_FA: Record<BmiCategory, string> = {
  underweight: "کمبود وزن",
  normal: "محدوده سالم",
  overweight: "اضافه وزن",
  obese: "چاقی",
};

/** WHO healthy weight band for a height. */
export function healthyWeightRange(heightCm: number): { min: number; max: number } {
  const h = heightCm / 100;
  return { min: Math.round(18.5 * h * h), max: Math.round(24.9 * h * h) };
}

/** One-rep max: Epley primary, Brzycki cross-check. */
export function oneRepMax(weightKg: number, reps: number): { epley: number; brzycki: number; recommended: number } {
  if (reps <= 0 || weightKg <= 0) return { epley: 0, brzycki: 0, recommended: 0 };
  const epley = weightKg * (1 + reps / 30);
  const brzycki = weightKg * (36 / (37 - Math.min(reps, 36)));
  const recommended = reps <= 10 ? (epley + brzycki) / 2 : epley;
  return {
    epley: Math.round(epley * 10) / 10,
    brzycki: Math.round(brzycki * 10) / 10,
    recommended: Math.round(recommended * 10) / 10,
  };
}

/** Percentage table for 1RM-based programming. */
export function oneRepMaxTable(oneRm: number): Array<{ pct: number; reps: number; weight: number }> {
  const rows: Array<{ pct: number; reps: number }> = [
    { pct: 95, reps: 2 },
    { pct: 90, reps: 4 },
    { pct: 85, reps: 6 },
    { pct: 80, reps: 8 },
    { pct: 75, reps: 10 },
    { pct: 70, reps: 12 },
    { pct: 65, reps: 15 },
  ];
  return rows.map((r) => ({ ...r, weight: Math.round((oneRm * r.pct) / 100 * 2) / 2 }));
}

/** Waist-to-height ratio (Ashwell). Healthy 0.4–0.49. */
export type WhtRCategory = "slim" | "healthy" | "elevated" | "high";
export function whtr(waistCm: number, heightCm: number): number {
  if (heightCm <= 0) return 0;
  return Math.round((waistCm / heightCm) * 100) / 100;
}
export function whtrCategory(value: number): WhtRCategory {
  if (value < 0.4) return "slim";
  if (value < 0.5) return "healthy";
  if (value < 0.6) return "elevated";
  return "high";
}
export const WHTR_FA: Record<WhtRCategory, string> = {
  slim: "لاغر",
  healthy: "سالم",
  elevated: "افزایش‌یافته",
  high: "بالا",
};

/** Ideal weight formulas (Devine 1974 baseline; Robinson variant). */
export function idealWeightRange(heightCm: number, sex: SexAtBirth): { min: number; max: number; formulaLabel: string } {
  const inchesOver5ft = Math.max(0, (heightCm - 152.4) / 2.54);
  const maleFactor = sex === "male" ? 1 : sex === "female" ? 0 : 0.5;
  const devine = 50 + maleFactor * 2.3 * inchesOver5ft;
  const robinsonBase = maleFactor === 1 ? 52 : maleFactor === 0 ? 49 : 50.5;
  const robinsonSlope = maleFactor === 1 ? 1.9 : maleFactor === 0 ? 1.7 : 1.8;
  const robinson = robinsonBase + robinsonSlope * inchesOver5ft;
  const low = Math.round(Math.min(devine, robinson));
  const high = Math.round(Math.max(devine, robinson) * 1.08);
  return { min: low, max: high, formulaLabel: "دیواین و رابینسون" };
}

/** Water intake: 33 ml/kg baseline, +420 ml per training hour. */
export function dailyWaterMl(weightKg: number, trainingMinutesPerDay: number): number {
  const base = weightKg * 33;
  const training = (trainingMinutesPerDay / 60) * 420;
  return Math.round((base + training) / 100) * 100;
}

export type MacroTargets = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  strategyLabel: string;
};

/** Evidence-anchored macro split by goal. */
export function computeMacroTargets(input: {
  sex: SexAtBirth;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: PrimaryGoal;
}): MacroTargets {
  const age = ageFromBirthYear(input.birthYear);
  const maintenance = tdee({ ...input, age });

  let calories = maintenance;
  let strategyLabel = "حفظ وزن";
  switch (input.goal) {
    case "lose_weight":
      calories = Math.round(maintenance * 0.8);
      strategyLabel = "کسری کالری ملایم (۲۰٪)";
      break;
    case "build_muscle":
      calories = Math.round(maintenance * 1.1);
      strategyLabel = "مازاد کنترل‌شده (۱۰٪)";
      break;
    case "recomp":
      calories = Math.round(maintenance * 0.95);
      strategyLabel = "ریکامپ (۵٪ کسری)";
      break;
    case "endurance":
      strategyLabel = "پشتیبانی استقامت";
      break;
    case "health":
      strategyLabel = "حفظ وزن";
      break;
  }
  const bmrFloor = Math.round(bmrMifflinStJeor({ ...input, age }) * 1.1);
  calories = Math.max(calories, bmrFloor);

  const proteinPerKg =
    input.goal === "build_muscle" ? 2.0 : input.goal === "lose_weight" ? 2.2 : input.goal === "recomp" ? 2.0 : 1.6;
  const proteinG = Math.round(input.weightKg * proteinPerKg);
  const fatG = Math.round((calories * 0.25) / 9);
  const carbsG = Math.max(50, Math.round((calories - proteinG * 4 - fatG * 9) / 4));
  const fiberG = Math.round(Math.max(25, (calories / 1000) * 14));

  return { calories, proteinG, carbsG, fatG, fiberG, strategyLabel };
}

/**
 * Readiness v1 — explainable composite (0–100).
 * Factors: sleep (35%), training load (30%), adherence (20%), recovery (15%).
 * Deterministic; absent inputs are disclosed as estimates, never fabricated.
 */
export type ReadinessFactorInput = {
  sleepQualityScore?: number | null; // 0..100
  sleepDurationMinutes?: number | null;
  trainingLoadLast3Days?: number | null;
  avgTrainingLoad14d?: number | null;
  adherenceLast7d?: number | null; // 0..1
  daysSinceLastWorkout?: number | null;
};

export const READINESS_VERSION = "v1";

export type ReadinessResult = {
  score: number;
  state: "ready" | "moderate" | "caution" | "recover";
  factors: Array<{ type: string; label: string; normalizedScore: number; weight: number; source: string }>;
};

export function computeReadiness(input: ReadinessFactorInput): ReadinessResult {
  const factors: ReadinessResult["factors"] = [];
  let weighted = 0;
  let totalWeight = 0;

  const push = (type: string, label: string, score: number, weight: number, source: string) => {
    factors.push({ type, label, normalizedScore: Math.round(score), weight, source });
    weighted += score * weight;
    totalWeight += weight;
  };

  const hasSleep = input.sleepQualityScore != null || input.sleepDurationMinutes != null;
  if (hasSleep) {
    const q = input.sleepQualityScore ?? 70;
    const dur = input.sleepDurationMinutes ?? 420;
    const durScore = Math.min(100, (dur / 480) * 100);
    push("sleep", "خواب", q * 0.5 + durScore * 0.5, 0.35, input.sleepQualityScore != null ? "manual+estimated" : "estimated");
  }

  const hasLoad = input.trainingLoadLast3Days != null && input.avgTrainingLoad14d != null;
  if (hasLoad) {
    const avgDaily14 = (input.avgTrainingLoad14d ?? 1) / 14;
    const recentDaily3 = (input.trainingLoadLast3Days ?? 0) / 3;
    const ratio = recentDaily3 / Math.max(1, avgDaily14);
    const loadScore = ratio > 1.6 ? 40 : ratio > 1.3 ? 60 : ratio > 0.6 ? 85 : 75;
    push("training_load", "بار تمرینی اخیر", loadScore, 0.3, "workouts");
  }

  if (input.adherenceLast7d != null) {
    push("adherence", "پایداری هفته", input.adherenceLast7d * 100, 0.2, "workouts+nutrition");
  }

  if (input.daysSinceLastWorkout != null) {
    const rec =
      input.daysSinceLastWorkout === 0 ? 80 : input.daysSinceLastWorkout === 1 ? 85 : input.daysSinceLastWorkout >= 5 ? 55 : 90;
    push("recovery", "روزهای ریکاوری", rec, 0.15, "workouts");
  }

  const score = totalWeight === 0 ? 70 : Math.round(weighted / totalWeight);
  const state = score >= 80 ? "ready" : score >= 60 ? "moderate" : score >= 40 ? "caution" : "recover";
  return { score: Math.min(100, Math.max(0, score)), state, factors };
}

export const READINESS_STATE_FA: Record<string, string> = {
  ready: "آماده تمرین",
  moderate: "متوسط",
  caution: "احتیاط",
  recover: "ریکاوری",
};

/** XP level curve: level n requires 150 * n^1.35 cumulative. Level 1 starts at 0. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(150 * Math.pow(level - 1, 1.35));
}

export function levelFromXp(xp: number): { level: number; currentLevelXp: number; nextLevelXp: number; progress: number } {
  let level = 1;
  while (xpForLevel(level + 1) <= xp && level < 99) level++;
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const progress = nextLevelXp > currentLevelXp ? (xp - currentLevelXp) / (nextLevelXp - currentLevelXp) : 0;
  return { level, currentLevelXp, nextLevelXp, progress };
}

/** Session volume: sum(weight × reps) across strength sets. */
export function sessionVolume(sets: Array<{ weightKg?: number | null; reps?: number | null; distanceM?: number | null }>): number {
  return sets.reduce((acc, s) => acc + (s.weightKg != null && s.reps != null ? s.weightKg * s.reps : 0), 0);
}
