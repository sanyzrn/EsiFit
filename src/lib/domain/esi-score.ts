/**
 * EsiScore — explainable composite fitness score (DESIGN_BIBLE signature viz).
 * Pure function. Bands + per-factor contribution are always shown so the
 * number is never mysterious (DESIGN_BIBLE: explainable progress indicators).
 */

export type EsiScoreFactorKey = "consistency" | "strength" | "volume" | "recovery" | "nutrition";

export type EsiScoreFactor = {
  key: EsiScoreFactorKey;
  labelFa: string;
  /** 0..100 raw factor score. */
  value: number;
  weight: number; // sums to 1
  hintFa: string;
};

export type EsiScoreBand = "starting" | "building" | "strong" | "elite";

export type EsiScoreResult = {
  score: number; // 0..100
  band: EsiScoreBand;
  bandFa: string;
  factors: EsiScoreFactor[];
};

export const ESI_SCORE_BAND_FA: Record<EsiScoreBand, string> = {
  starting: "تازه‌کار",
  building: "در حال ساخت",
  strong: "قوی",
  elite: "در سطح elite",
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export type EsiScoreInput = {
  /** Sessions in last 28 days vs weekly target * 4. */
  sessionsLast28d: number;
  weeklyTarget: number;
  /** Current active streak days. */
  streakDays: number;
  /** Count of PRs achieved in last 30 days. */
  prsLast30d: number;
  /** Relative strength trend: est. 1RM growth percent across key lifts over 90d (null if unknown). */
  strengthTrendPct: number | null;
  /** Weekly tonnage trend percent over 3 weeks (null if unknown). */
  volumeTrendPct: number | null;
  /** Average readiness of last 14 days (null if never computed). */
  avgReadiness14d: number | null;
  /** Nutrition days logged in last 28 days. */
  nutritionDaysLogged28d: number;
};

export function computeEsiScore(input: EsiScoreInput): EsiScoreResult {
  // Consistency (30%): adherence to target + streak bonus.
  const target28 = Math.max(4, input.weeklyTarget * 4);
  const adherence = clamp((input.sessionsLast28d / target28) * 80);
  const streakBonus = Math.min(20, input.streakDays * 2.5);
  const consistency = clamp(adherence + streakBonus);

  // Strength (25%): PR recency + trend of est. 1RMs.
  const prScore = clamp(input.prsLast30d * 18);
  const trendScore = input.strengthTrendPct == null ? prScore * 0.5 : clamp(50 + input.strengthTrendPct * 12);
  const strength = clamp(prScore * 0.45 + trendScore * 0.55);

  // Volume (20%): weekly tonnage progression.
  const volume = input.volumeTrendPct == null ? clamp(input.sessionsLast28d * 8) : clamp(50 + input.volumeTrendPct * 3);

  // Recovery (15%): 14-day average readiness.
  const recovery = input.avgReadiness14d == null ? 50 : clamp(input.avgReadiness14d);

  // Nutrition (10%): logging discipline (28 days target = 24 logged).
  const nutrition = clamp((input.nutritionDaysLogged28d / 24) * 100);

  const factors: EsiScoreFactor[] = [
    { key: "consistency", labelFa: "پیوستگی", value: Math.round(consistency), weight: 0.3, hintFa: "جلسات هفته‌های اخیر نسبت به هدف + استریک" },
    { key: "strength", labelFa: "قدرت", value: Math.round(strength), weight: 0.25, hintFa: "رکوردهای ۳۰ روز اخیر و روند بیشینه تخمینی" },
    { key: "volume", labelFa: "حجم", value: Math.round(volume), weight: 0.2, hintFa: "روند تُناژ هفتگی" },
    { key: "recovery", labelFa: "ریکاوری", value: Math.round(recovery), weight: 0.15, hintFa: "میانگین آمادگی روزانه ۱۴ روز اخیر" },
    { key: "nutrition", labelFa: "تغذیه", value: Math.round(nutrition), weight: 0.1, hintFa: "نظم ثبت وعده‌ها" },
  ];

  const score = Math.round(factors.reduce((sum, f) => sum + f.value * f.weight, 0));
  const band: EsiScoreBand = score >= 85 ? "elite" : score >= 65 ? "strong" : score >= 40 ? "building" : "starting";

  return { score, band, bandFa: ESI_SCORE_BAND_FA[band], factors };
}
