/**
 * Goal engine — progress computation for the Goal entity.
 * Pure functions only; data access happens at the API boundary.
 * Goal.metaJson carries per-type context: { exerciseSlug?, pattern?, direction? }.
 */

export type GoalType = "weight" | "workout_frequency" | "strength" | "volume" | "nutrition_log";

export const GOAL_TYPES: GoalType[] = ["weight", "workout_frequency", "strength", "volume", "nutrition_log"];

export const GOAL_TYPE_FA: Record<GoalType, string> = {
  weight: "وزن بدن",
  workout_frequency: "تعداد تمرین هفتگی",
  strength: "قدرت (رکورد حرکت)",
  volume: "حجم تمرینی هفتگی",
  nutrition_log: "ثبت منظم تغذیه",
};

export const GOAL_UNIT_FA: Record<string, string> = {
  kg: "کیلوگرم",
  session: "جلسه",
  sessions_per_week: "جلسه در هفته",
  sessions_4w: "جلسه در ۴ هفته",
  kg_per_week: "کیلوگرم در هفته",
  days_4w: "روز ثبت‌شده در ۴ هفته",
  day: "روز",
};

/** Canonical unit key for a goal type — single source for create + display. */
export function unitForGoalType(type: string): string {
  switch (type) {
    case "weight":
    case "strength":
      return "kg";
    case "workout_frequency":
      return "sessions_per_week";
    case "volume":
      return "kg_per_week";
    case "nutrition_log":
      return "days_4w";
    default:
      return "day";
  }
}

export type GoalProgress = {
  percent: number; // 0..100 clamped
  currentValue: number;
  targetValue: number;
  startValue: number;
  direction: "up" | "down";
  achieved: boolean;
  /** Linear-pace projection to hit the target; null when pace is zero or target passed. */
  etaDays: number | null;
  /** Persian one-line status, e.g. «۴٫۲ کیلوگرم مانده». */
  statusFa: string;
};

export type GoalLike = {
  type: string;
  startValue: number;
  targetValue: number;
  unit: string;
  startDate: string;
  targetDate: string;
  metaJson?: string | null;
};

/** True when the goal expects the metric to increase (most) or decrease (weight loss). */
export function goalDirection(goal: Pick<GoalLike, "type" | "targetValue" | "startValue" | "metaJson">): "up" | "down" {
  if (goal.type === "weight") {
    try {
      const meta = JSON.parse(goal.metaJson ?? "{}") as { direction?: "up" | "down" };
      if (meta.direction === "up") return "up";
    } catch {
      /* fall through */
    }
    return goal.targetValue <= goal.startValue ? "down" : "up";
  }
  return "up";
}

export function computeGoalProgress(
  goal: GoalLike,
  currentValue: number,
  todayISO: string,
): GoalProgress {
  const direction = goalDirection(goal);
  const total = Math.abs(goal.targetValue - goal.startValue);
  const done =
    direction === "down"
      ? goal.startValue - currentValue
      : currentValue - goal.startValue;
  const rawPercent = total <= 0 ? (currentValue >= goal.targetValue ? 100 : 0) : (done / total) * 100;
  const percent = Math.max(0, Math.min(100, Math.round(rawPercent)));
  const achieved =
    direction === "down" ? currentValue <= goal.targetValue : currentValue >= goal.targetValue;

  // Pace from elapsed time (linear); forecast remaining days at same pace.
  const elapsed = Math.max(1, daysBetween(todayISO, goal.startDate));
  const pacePerDay = done / elapsed;
  const remaining =
    direction === "down"
      ? currentValue - goal.targetValue
      : goal.targetValue - currentValue;
  const etaDays = pacePerDay > 1e-9 ? Math.ceil(remaining / pacePerDay) : null;

  return {
    percent,
    currentValue,
    targetValue: goal.targetValue,
    startValue: goal.startValue,
    direction,
    achieved,
    etaDays: achieved ? 0 : etaDays,
    statusFa: describeProgressFa(goal, currentValue, achieved, etaDays),
  };
}

function describeProgressFa(
  goal: GoalLike,
  current: number,
  achieved: boolean,
  etaDays: number | null,
): string {
  if (achieved) return "هدف محقق شده — آفرین!";
  const remaining = Math.abs(goal.targetValue - current);
  const value = formatFa(remaining);
  const unit = GOAL_UNIT_FA[goal.unit] ?? goal.unit;
  if (etaDays != null && etaDays > 0) {
    return `${value} ${unit} مانده — با این سرعت حدود ${formatFa(etaDays)} روز دیگر`;
  }
  return `${value} ${unit} مانده`;
}

export function daysBetween(aISO: string, bISO: string): number {
  const a = new Date(`${aISO}T00:00:00Z`).getTime();
  const b = new Date(`${bISO}T00:00:00Z`).getTime();
  return Math.round((a - b) / 86_400_000);
}

function formatFa(n: number): string {
  const rounded = Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
  return toFaDigits(String(rounded)).replace(".", "٫");
}

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
function toFaDigits(s: string): string {
  return s.replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}
