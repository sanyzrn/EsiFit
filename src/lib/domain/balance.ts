/**
 * Structural balance — are opposing muscle groups trained in proportion?
 * Pure maths over weekly hard-set counts per muscle group (EsiFit group slugs).
 * These are coaching heuristics, not diagnoses: wording stays advisory.
 */

export type BalancePairKey = "push_pull" | "quad_ham" | "delts";

export type BalanceStatus = "balanced" | "lean_a" | "lean_b" | "insufficient";

export type BalancePair = {
  key: BalancePairKey;
  titleFa: string;
  aLabelFa: string;
  bLabelFa: string;
  aSets: number;
  bSets: number;
  /** b ÷ a, or null when there is nothing to compare. */
  ratio: number | null;
  status: BalanceStatus;
  noteFa: string;
};

type PairDef = {
  key: BalancePairKey;
  titleFa: string;
  aLabelFa: string;
  bLabelFa: string;
  a: string[];
  b: string[];
  /** Acceptable b÷a range. */
  min: number;
  max: number;
  leanAFa: string;
  leanBFa: string;
  okFa: string;
};

const PAIRS: PairDef[] = [
  {
    key: "push_pull",
    titleFa: "فشار در برابر کشش بالاتنه",
    aLabelFa: "فشار",
    bLabelFa: "کشش",
    a: ["chest", "chest_upper", "front_delts", "side_delts", "triceps"],
    b: ["lats", "upper_back", "rear_delts", "traps", "biceps"],
    min: 0.9,
    max: 1.6,
    leanAFa: "فشار بیشتر از کشش است — یک حرکت کشش (پارویی یا زیربغل) به برنامه اضافه کنید تا شانه‌ها متعادل بمانند.",
    leanBFa: "کشش بیشتر از فشار است — کمی حجم پرس برای سینه و سرشانه اضافه کنید.",
    okFa: "فشار و کشش متعادل است.",
  },
  {
    key: "quad_ham",
    titleFa: "جلو ران در برابر پشت ران",
    aLabelFa: "جلو ران",
    bLabelFa: "پشت ران",
    a: ["quads"],
    b: ["hamstrings", "glutes"],
    min: 0.7,
    max: 1.6,
    leanAFa: "جلو ران بیشتر کار می‌کند — دو ست ددلیفت رومانیایی یا لگ‌کرل پشت ران را قوی‌تر می‌کند.",
    leanBFa: "پشت ران و باسن غالب‌اند — یک حرکت جلو ران (لگ‌پرس یا اسکوات) متعادل‌تر می‌کند.",
    okFa: "جلو و پشت ران متعادل است.",
  },
  {
    key: "delts",
    titleFa: "جلو در برابر پشت شانه",
    aLabelFa: "سرشانه جلو",
    bLabelFa: "سرشانه عقب",
    a: ["front_delts"],
    b: ["rear_delts", "upper_back"],
    min: 0.8,
    max: 3,
    leanAFa: "سرشانه جلو تحت‌فشار است — فیس‌پول یا نشر خم پشت شانه را اضافه کنید.",
    leanBFa: "پشت شانه بیشتر است — مشکلی نیست، فقط جلو شانه را فراموش نکنید.",
    okFa: "شانه‌ها از جلو و عقب متعادل کار می‌کنند.",
  },
];

/** Below this many weekly sets on both sides together there is not enough to judge. */
const MIN_WEEKLY_SETS = 6;

const sum = (sets: Record<string, number>, slugs: string[]) => slugs.reduce((a, s) => a + (sets[s] ?? 0), 0);
const r1 = (v: number) => Math.round(v * 10) / 10;

export function computeBalance(weeklySetsByGroup: Record<string, number>): BalancePair[] {
  return PAIRS.map((def) => {
    const a = sum(weeklySetsByGroup, def.a);
    const b = sum(weeklySetsByGroup, def.b);
    const base = {
      key: def.key,
      titleFa: def.titleFa,
      aLabelFa: def.aLabelFa,
      bLabelFa: def.bLabelFa,
      aSets: r1(a),
      bSets: r1(b),
    };
    if (a + b < MIN_WEEKLY_SETS) {
      return { ...base, ratio: null, status: "insufficient" as const, noteFa: "داده کافی نیست — چند هفته تمرین ثبت کنید تا تعادل سنجیده شود." };
    }
    if (a === 0) {
      return { ...base, ratio: null, status: "lean_b" as const, noteFa: def.leanBFa };
    }
    const ratio = b / a;
    if (ratio < def.min) return { ...base, ratio: r1(ratio), status: "lean_a" as const, noteFa: def.leanAFa };
    if (ratio > def.max) return { ...base, ratio: r1(ratio), status: "lean_b" as const, noteFa: def.leanBFa };
    return { ...base, ratio: r1(ratio), status: "balanced" as const, noteFa: def.okFa };
  });
}

// --------------------------------------------------------------- recovery

export type RecoveryState = "recovering" | "ready" | "neglected";

export const RECOVERY_RECOVERING_HOURS = 48;
export const RECOVERY_NEGLECTED_HOURS = 24 * 8;

export function recoveryState(hoursSince: number | null): RecoveryState {
  if (hoursSince == null || hoursSince >= RECOVERY_NEGLECTED_HOURS) return "neglected";
  return hoursSince < RECOVERY_RECOVERING_HOURS ? "recovering" : "ready";
}

/** 0–100 "freshness of the last stimulus" for painting the anatomy map. */
export function recencyIntensity(hoursSince: number | null): number {
  if (hoursSince == null) return 0;
  const horizon = 96;
  return Math.max(0, Math.round(100 - (hoursSince / horizon) * 100));
}
