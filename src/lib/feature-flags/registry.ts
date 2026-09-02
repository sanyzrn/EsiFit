/**
 * Typed feature-flag registry per FEATURE_FLAGS.md.
 * Fail-closed: unknown flags resolve to `false` in production.
 * Flags are NOT authorization — plan gating is enforced server-side
 * through lib/entitlements.
 */

export const FEATURE_FLAGS = [
  "BLOG",
  "AUTH",
  "DASHBOARD",
  "COMMAND_PALETTE",
  "READINESS_SCORE",
  "WORKOUTS",
  "NUTRITION",
  "CALCULATORS",
  "ANALYTICS",
  "MUSCLE_HEATMAP",
  "VOICE_LOGGING",
  "OFFLINE_TRACKERS",
  "GAMIFICATION",
  "COMMUNITY",
  "CHALLENGES",
  "SHOP",
  "NOTIFICATIONS",
  "WEEKLY_RECAP",
  "AI_CHAT",
  "AI_INSIGHTS",
  "AI_PROVIDER_SWITCHING",
  "LIVE_WORKOUT_MODE",
  "PERSONAL_RECORDS",
  "PROGRESS_PHOTOS",
  "BODY_SCAN",
  "PAIN_INJURY_MAP",
  "EXERCISE_SWAP",
  "ADAPTIVE_COACH",
  "ESISCORE",
  "PLATEAU_DETECTOR",
  "GOAL_ENGINE",
  "FOOD_PHOTO_LOGGING",
  "WEARABLES",
  "PRIVATE_CHALLENGES",
  "COACH_MARKETPLACE",
  "AI_CREDITS",
] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

export type FeatureFlagConfig = {
  label: string;
  default: boolean;
  requiresMember?: boolean;
  /** Hard dependencies — if a parent is off, the child resolves off. */
  dependsOn?: FeatureFlag[];
};

/**
 * Registry — dev defaults from FEATURE_FLAGS.md.
 * Environment override: ESIFIT_FLAG_<NAME>=on|off (server) / NEXT_PUBLIC_ESIFIT_FLAG_<NAME> (client-safe build constant).
 */
export const FLAG_REGISTRY: Record<FeatureFlag, FeatureFlagConfig> = {
  BLOG: { label: "مجله اسی‌فیت", default: true },
  AUTH: { label: "ورود و ثبت‌نام", default: true },
  DASHBOARD: { label: "داشبورد اعضا", default: true },
  COMMAND_PALETTE: { label: "پالت دستورات", default: true },
  READINESS_SCORE: { label: "امتیاز آمادگی روزانه", default: true, dependsOn: ["DASHBOARD"] },
  WORKOUTS: { label: "تمرین‌ها", default: true },
  NUTRITION: { label: "تغذیه", default: true },
  CALCULATORS: { label: "ماشین‌حساب‌ها", default: true },
  ANALYTICS: { label: "تحلیل پیشرفت", default: true },
  MUSCLE_HEATMAP: { label: "نقشه حرارتی عضلات", default: true, dependsOn: ["ANALYTICS", "WORKOUTS"] },
  VOICE_LOGGING: { label: "ثبت صوتی ست‌ها", default: true, dependsOn: ["WORKOUTS"] },
  OFFLINE_TRACKERS: { label: "ردیابی آفلاین", default: true },
  GAMIFICATION: { label: "امتیاز و نشان‌ها", default: true },
  COMMUNITY: { label: "انجمن", default: true },
  CHALLENGES: { label: "چالش‌ها", default: true },
  SHOP: { label: "فروشگاه", default: true },
  NOTIFICATIONS: { label: "اعلان‌ها", default: true },
  WEEKLY_RECAP: { label: "گزارش هفتگی", default: true, dependsOn: ["ANALYTICS"] },
  AI_CHAT: { label: "دستیار هوشمند", default: true, requiresMember: true },
  AI_INSIGHTS: { label: "بینش‌های هوشمند", default: true, requiresMember: true },
  AI_PROVIDER_SWITCHING: { label: "سوییچ ارائه‌دهنده AI", default: false },
  LIVE_WORKOUT_MODE: { label: "حالت تمرین زنده", default: true, dependsOn: ["WORKOUTS"] },
  PERSONAL_RECORDS: { label: "رکوردهای شخصی", default: true, dependsOn: ["WORKOUTS", "ANALYTICS"] },
  PROGRESS_PHOTOS: { label: "عکس‌های پیشرفت", default: false, dependsOn: ["ANALYTICS"] },
  BODY_SCAN: { label: "تحلیل تصویری بدن", default: false, requiresMember: true, dependsOn: ["PROGRESS_PHOTOS"] },
  PAIN_INJURY_MAP: { label: "نقشه درد و محدودیت", default: true, dependsOn: ["WORKOUTS"] },
  EXERCISE_SWAP: { label: "جایگزین هوشمند حرکات", default: true, dependsOn: ["WORKOUTS"] },
  ADAPTIVE_COACH: { label: "مربی تطبیقی", default: true, requiresMember: true, dependsOn: ["WORKOUTS", "READINESS_SCORE"] },
  ESISCORE: { label: "امتیاز اسی", default: true, dependsOn: ["ANALYTICS"] },
  PLATEAU_DETECTOR: { label: "تشخیص ثبات", default: true, dependsOn: ["ANALYTICS"] },
  GOAL_ENGINE: { label: "موتور هدف", default: true, dependsOn: ["DASHBOARD"] },
  FOOD_PHOTO_LOGGING: { label: "ثبت غذا با عکس", default: false, requiresMember: true, dependsOn: ["NUTRITION", "AI_INSIGHTS"] },
  WEARABLES: { label: "اتصال ساعت هوشمند", default: false },
  PRIVATE_CHALLENGES: { label: "چالش خصوصی", default: true, dependsOn: ["CHALLENGES"] },
  COACH_MARKETPLACE: { label: "بازار مربیان", default: false, requiresMember: true },
  AI_CREDITS: { label: "اعتبارات هوش مصنوعی", default: false, requiresMember: true },
};

/** Environment overrides (server-side; per-deployment). */
function envOverride(flag: string): boolean | undefined {
  if (process.env.NEXT_PUBLIC_ESIFIT_FLAG_ === "__never__") return undefined;
  const raw = process.env[`ESIFIT_FLAG_${flag}`];
  if (raw === "on") return true;
  if (raw === "off") return false;
  return undefined;
}

/**
 * Resolve a flag with dependency closure (server-safe).
 * Unknown flags fail closed.
 */
export function resolveFeatureFlag(flag: string): boolean {
  const config = FLAG_REGISTRY[flag as FeatureFlag];
  if (!config) {
    return process.env.NODE_ENV !== "production" ? false : false;
  }
  const override = envOverride(flag);
  if (override === false) return false;
  if (config.dependsOn) {
    for (const parent of config.dependsOn) {
      if (!resolveFeatureFlag(parent)) return false;
    }
  }
  return override ?? config.default;
}

/** Typed list of enabled flags (server-side). */
export function resolveEnabledFlags(): Record<FeatureFlag, boolean> {
  const out = {} as Record<FeatureFlag, boolean>;
  for (const flag of FEATURE_FLAGS) out[flag] = resolveFeatureFlag(flag);
  return out;
}
