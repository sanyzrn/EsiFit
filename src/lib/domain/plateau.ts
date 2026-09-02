/**
 * Plateau & progress insights — pure analysis over per-exercise strength
 * series and weekly adherence. No DB access; callers shape the inputs.
 *
 * Strength series: best estimated 1RM per session for one exercise, ordered
 * chronologically. The detector only fires with enough evidence (≥4 sessions)
 * so beginners never see noisy "plateau" warnings.
 */

export type StrengthSeries = {
  exerciseSlug: string;
  exerciseName: string;
  /** ISO date of each session, ascending. */
  dates: string[];
  /** Best est. 1RM (kg) per session, same order as dates. */
  bestKg: number[];
};

export type WeeklyAdherence = {
  /** ISO week-start dates ascending, last N weeks. */
  weekStarts: string[];
  sessions: number[];
  plannedPerWeek: number;
};

export type Insight = {
  id: string;
  kind: "strength_plateau" | "volume_stall" | "adherence_drop" | "comeback_gap" | "progress_momentum" | "pr_streak";
  severity: "info" | "success" | "warning";
  titleFa: string;
  messageFa: string;
  actionFa?: string;
  exerciseSlug?: string;
};

const RELATIVE_EPSILON = 0.004; // 0.4% — measurement noise on est. 1RM
const FLAT_SESSIONS = 3;

/** Detect a strength plateau on one exercise series. */
export function detectStrengthPlateau(series: StrengthSeries): boolean {
  if (series.bestKg.length < FLAT_SESSIONS + 1) return false;
  const recent = series.bestKg.slice(-FLAT_SESSIONS);
  const priorBest = Math.max(...series.bestKg.slice(0, -FLAT_SESSIONS));
  const recentBest = Math.max(...recent);
  // No meaningful improvement over the recent block vs anything before it.
  if (recentBest < priorBest * (1 + RELATIVE_EPSILON)) return true;
  // All recent sessions effectively identical → stalled.
  const max = Math.max(...recent);
  const min = Math.min(...recent);
  return max - min <= max * RELATIVE_EPSILON && series.bestKg.length >= 5;
}

/** Weekly tonnage stall: flat or declining across the last 3 complete weeks. */
export function detectVolumeStall(weeklyTonnage: number[]): boolean {
  if (weeklyTonnage.length < 4) return false;
  const recent = weeklyTonnage.slice(-3);
  const peak = Math.max(...weeklyTonnage);
  const flat = Math.max(...recent) - Math.min(...recent) <= Math.max(...recent) * 0.05;
  const declining = recent[2] < peak * 0.85;
  return flat || declining;
}

/** Build all insights from raw series + adherence. Ordered: problems first, then wins. */
export function buildProgressInsights(input: {
  series: StrengthSeries[];
  weeklyTonnage: number[];
  adherence: WeeklyAdherence;
  daysSinceLastSession: number | null;
  prsLast30Days: number;
  weeklySessionsTarget: number;
}): Insight[] {
  const out: Insight[] = [];

  // 1) Strength plateaus (cap at 2 to avoid wall of warnings)
  let plateauCount = 0;
  for (const s of input.series) {
    if (plateauCount >= 2) break;
    if (detectStrengthPlateau(s)) {
      plateauCount += 1;
      out.push({
        id: `plateau:${s.exerciseSlug}`,
        kind: "strength_plateau",
        severity: "warning",
        titleFa: `سکوت قدرت در ${s.exerciseName}`,
        messageFa: "چند جلسه اخیر وزنه‌ها بالا نرفته است — بدن به این محرک عادت کرده.",
        actionFa: "یک هفته حجم را ۱۰٪ کم کنید یا دامنه تکرار را عوض کنید (مثلاً ۸–۱۲ به ۵–۶)",
        exerciseSlug: s.exerciseSlug,
      });
    }
  }

  // 2) Weekly volume stall
  if (detectVolumeStall(input.weeklyTonnage)) {
    out.push({
      id: "volume:stall",
      kind: "volume_stall",
      severity: "warning",
      titleFa: "حجم تمرینی سر جایش مانده",
      messageFa: "حجم هفتگی سه هفته است که رشد نکرده یا کم شده است.",
      actionFa: "یک ست به حرکات اصلی اضافه کنید یا یک جلسه به هفته بیفزایید",
    });
  }

  // 3) Adherence drop (last 2 weeks below target)
  const { sessions, plannedPerWeek } = input.adherence;
  const last2 = sessions.slice(-2);
  if (sessions.length >= 2 && last2.every((n) => n < plannedPerWeek - 1)) {
    out.push({
      id: "adherence:drop",
      kind: "adherence_drop",
      severity: "warning",
      titleFa: "پیوستگی تمرین افت کرده",
      messageFa: `دو هفته اخیر کمتر از برنامه (${toFa(plannedPerWeek)} جلسه در هفته) تمرین کرده‌اید.`,
      actionFa: "هدف را کوتاه‌تر کنید: دو جلسه کوتاه ۳۰ دقیقه‌ای بهتر از صفر جلسه است",
    });
  }

  // 4) Comeback gap
  if (input.daysSinceLastSession != null && input.daysSinceLastSession >= 7) {
    out.push({
      id: "gap:comeback",
      kind: "comeback_gap",
      severity: "info",
      titleFa: "بازگشت بعد از وقفه",
      messageFa: `${toFa(input.daysSinceLastSession)} روز از آخرین تمرین گذشته است.`,
      actionFa: "جلسه اول را با ۸۰٪ حجم همیشگی شروع کنید تا بدن دوباره شرط شود",
    });
  }

  // 5) Wins — momentum and PR streak (progress insights, not only problems)
  const momentum = input.weeklyTonnage.length >= 3 && input.weeklyTonnage.at(-1)! > input.weeklyTonnage.at(-3)! * 1.05;
  if (momentum) {
    out.push({
      id: "momentum:volume",
      kind: "progress_momentum",
      severity: "success",
      titleFa: "روند صعودی حجم",
      messageFa: "حجم تمرینی هفتگی در حال رشد است — همین‌طور ادامه بدهید.",
    });
  }
  if (input.prsLast30Days > 0) {
    out.push({
      id: "prs:recent",
      kind: "pr_streak",
      severity: "success",
      titleFa: `رکوردهای تازه (${toFa(input.prsLast30Days)} عدد)`,
      messageFa: "در ۳۰ روز گذشته رکورد شخصی ثبت کرده‌اید — برنامه جواب می‌دهد.",
    });
  }

  return out;
}

function toFa(n: number): string {
  return String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}
