/**
 * Adaptive Coach — deterministic guidance rules (roadmap: ADAPTIVE_COACH).
 * Combines readiness, adherence, fatigue signals and plateau state into a
 * concrete today-plan adjustment. Pure function; the dashboard passes fresh data.
 */

export type ReadinessState = "ready" | "moderate" | "caution" | "recover";

export type CoachTone = "push" | "maintain" | "adjust" | "recover" | "return";

export type CoachGuidance = {
  tone: CoachTone;
  /** Percent adjustment to planned working volume (−30..+10). */
  volumeModifierPercent: number;
  /** Persian headline (short, human). */
  messageFa: string;
  /** One concrete cue for today. */
  cueFa: string;
  /** Whether the user should avoid true-max attempts today. */
  avoidMaxAttempts: boolean;
};

export type AdaptiveCoachInput = {
  readiness: { score: number; state: ReadinessState } | null;
  /** Average self-reported RPE of the last completed session (null if none). */
  lastSessionRpe: number | null;
  /** Days since the last completed session (null = no history). */
  daysSinceLastSession: number | null;
  /** Sessions completed in the last 14 days. */
  sessionsLast14d: number;
  /** Planned sessions per week. */
  weeklyTarget: number;
  plateauDetected: boolean;
};

const STATE_FA: Record<ReadinessState, string> = {
  ready: "آماده",
  moderate: "متوسط",
  caution: "با احتیاط",
  recover: "نیاز به ریکاوری",
};

export function adaptiveCoach(input: AdaptiveCoachInput): CoachGuidance {
  const lowReadiness =
    input.readiness?.state === "caution" || input.readiness?.state === "recover";

  // 1) Comeback after a break — safety before ambition.
  if (input.daysSinceLastSession != null && input.daysSinceLastSession >= 6) {
    return {
      tone: "return",
      volumeModifierPercent: -20,
      messageFa: "بعد از وقفه، اولویت با بازگشت اصولی است نه جبرانِ عقب‌افتادگی.",
      cueFa: "امروز ۸۰٪ حجم همیشگی: ست آخر هر حرکت را حذف کن و RPE را زیر ۸ نگه دار.",
      avoidMaxAttempts: true,
    };
  }

  // 2) Low readiness — protect recovery.
  if (lowReadiness) {
    const state = input.readiness?.state ?? "caution";
    return {
      tone: "recover",
      volumeModifierPercent: state === "recover" ? -30 : -20,
      messageFa: `آمادگی امروز «${STATE_FA[state]}» است (${toFa(input.readiness?.score ?? 0)} از ۱۰۰) — بدنِ خسته با وزنه سنگین درمان نمی‌شود.`,
      cueFa: "گرم‌کردن طولانی‌تر، کاهش ۲ تا ۳ ست از هر حرکت و اولویت با تکنیک تمیز",
      avoidMaxAttempts: true,
    };
  }

  // 3) High accumulated fatigue (RPE ≥ 9 last session) without low readiness.
  if (input.lastSessionRpe != null && input.lastSessionRpe >= 8.8) {
    return {
      tone: "maintain",
      volumeModifierPercent: -10,
      messageFa: "جلسه قبل سنگین بود — امروز حجم را نگه می‌داریم تا خستگی انباشته نشود.",
      cueFa: "همان وزنه‌های جلسه قبل را با تکرارهای کنترل‌شده بزن؛ افزودن وزنه لازم نیست",
      avoidMaxAttempts: true,
    };
  }

  // 4) Plateau with good readiness — change the stimulus.
  if (input.plateauDetected && input.readiness?.state === "ready") {
    return {
      tone: "adjust",
      volumeModifierPercent: 0,
      messageFa: "چند حرکت مدتی است رشد نکرده‌اند — بدن محرک تازه می‌خواهد، نه محرک بیشتر.",
      cueFa: "دامنه تکرار یکی از حرکات اصلی را عوض کن (۸–۱۲ به ۵–۶ با وزنه سنگین‌تر) یا جایگزین هوشمند بزن",
      avoidMaxAttempts: false,
    };
  }

  // 5) Green light — earn the push.
  const adherenceOk = input.sessionsLast14d >= Math.max(2, Math.round((input.weeklyTarget * 2) * 0.75));
  if (input.readiness?.state === "ready" && adherenceOk) {
    return {
      tone: "push",
      volumeModifierPercent: 5,
      messageFa: "آمادگی و پیوستگی‌ات خوب است — امروز روزِ فشار است.",
      cueFa: "در حرکت اصلی امروز یک ست اضافه کن یا ۲٫۵ کیلوگرم به وزنه‌های کاری بیفزای",
      avoidMaxAttempts: false,
    };
  }

  // 6) Default — steady work.
  return {
    tone: "maintain",
    volumeModifierPercent: 0,
    messageFa: "برنامه را طبق روال اجرا کن؛ ثبات، خودش پیشرفت می‌سازد.",
    cueFa: "روی سرعت و کیفیت تکنیک در ست‌های آخر تمرکز کن",
    avoidMaxAttempts: false,
  };
}

function toFa(n: number): string {
  return String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}
