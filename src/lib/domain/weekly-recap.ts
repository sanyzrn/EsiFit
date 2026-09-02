/**
 * Weekly Recap — rules-based Persian narrative over last-week metrics
 * (flag WEEKLY_RECAP). Entitlement `weeklyRecap` gates the surface; the AI
 * layer (deepContext tiers) may refine the narrative, never invent metrics.
 */

export type RecapMetrics = {
  weekStart: string; // ISO date (Saturday)
  sessions: number;
  plannedSessions: number;
  tonnageKg: number;
  prevTonnageKg: number | null;
  prs: Array<{ exerciseName: string; valueKg: number }>;
  avgReadiness: number | null;
  nutritionDaysLogged: number; // out of 7
  streakDays: number;
  weightDeltaKg: number | null;
  topExerciseName: string | null;
};

export type WeeklyRecapResult = {
  metrics: RecapMetrics;
  contentFa: string;
  highlights: string[];
  attention: string[];
};

const FA = (n: number): string => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
const faDecimal = (n: number): string => FA(Math.round(n * 10) / 10).replace(".", "٫");
const faTonnage = (kg: number): string => (kg >= 1000 ? `${faDecimal(kg / 1000)} تُن` : `${FA(Math.round(kg))} کیلوگرم`);

export function buildWeeklyRecap(m: RecapMetrics): WeeklyRecapResult {
  const highlights: string[] = [];
  const attention: string[] = [];

  // ---- Sessions & adherence ----
  const adherence = m.plannedSessions > 0 ? m.sessions / m.plannedSessions : m.sessions > 0 ? 1 : 0;
  let sessionSentence: string;
  if (m.sessions === 0) {
    sessionSentence = "هفته گذشته هیچ جلسه تمرینی ثبت نشد.";
    attention.push("شروع دوباره کوچک باشد: یک جلسه ۳۰ دقیقه‌ای برای هفته پیش‌رو برنامه‌ریزی کن.");
  } else if (adherence >= 1) {
    sessionSentence = `${FA(m.sessions)} جلسه تمرین را کامل اجرا کردی — برنامه‌ات با زندگی‌ات هم‌راستا بود.`;
    highlights.push(`${FA(m.sessions)} جلسه کامل`);
  } else if (adherence >= 0.6) {
    sessionSentence = `${FA(m.sessions)} جلسه از ${FA(m.plannedSessions)} جلسه برنامه را انجام دادی؛ نیمه‌پرِ لیوان، قابل قبول است.`;
  } else {
    sessionSentence = `${FA(m.sessions)} جلسه از ${FA(m.plannedSessions)} جلسه برنامه اجرا شد — کمتر از انتظار.`;
    attention.push("اگر برنامه واقع‌بینانه نیست، روزهای تمرین را با مربی/تنظیمات بازنگری کن.");
  }

  // ---- Tonnage & trend ----
  let tonnageSentence = "";
  if (m.tonnageKg > 0) {
    if (m.prevTonnageKg != null && m.prevTonnageKg > 0) {
      const delta = (m.tonnageKg - m.prevTonnageKg) / m.prevTonnageKg;
      if (delta >= 0.05) {
        tonnageSentence = `حجم کل ${faTonnage(m.tonnageKg)} بود؛ حدود ${faDecimal(Math.abs(delta) * 100)}٪ بیشتر از هفته قبل.`;
        highlights.push("رشد حجم هفتگی");
      } else if (delta <= -0.15) {
        tonnageSentence = `حجم کل ${faTonnage(m.tonnageKg)} بود؛ کمتر از هفته قبل (${faTonnage(m.prevTonnageKg)}).`;
        attention.push("افت حجم می‌تواند نشانه خستگی یا شلوغی هفته باشد — نه لزوماً بی‌انگیزگی.");
      } else {
        tonnageSentence = `حجم کل ${faTonnage(m.tonnageKg)} بود؛ هم‌سطح هفته قبل.`;
      }
    } else {
      tonnageSentence = `حجم کل ${faTonnage(m.tonnageKg)} تمرین ثبت شد.`;
    }
  }

  // ---- PRs ----
  let prSentence = "";
  if (m.prs.length === 1) {
    prSentence = `یک رکورد شخصی جدید در «${m.prs[0].exerciseName}» (${faDecimal(m.prs[0].valueKg)} کیلوگرم) — تبریک!`;
    highlights.push(`رکورد جدید: ${m.prs[0].exerciseName}`);
  } else if (m.prs.length > 1) {
    const names = m.prs.slice(0, 2).map((p) => `«${p.exerciseName}»`).join(" و ");
    prSentence = `${FA(m.prs.length)} رکورد شخصی ثبت شد، از جمله ${names}.`;
    highlights.push(`${FA(m.prs.length)} رکورد جدید`);
  }

  // ---- Readiness ----
  let readinessSentence = "";
  if (m.avgReadiness != null) {
    if (m.avgReadiness >= 75) {
      readinessSentence = `میانگین آمادگی ${FA(Math.round(m.avgReadiness))} از ۱۰۰ بود — بدنت به برنامه جواب مثبت می‌دهد.`;
    } else if (m.avgReadiness >= 55) {
      readinessSentence = `میانگین آمادگی ${FA(Math.round(m.avgReadiness))} از ۱۰۰ بود؛ قابل قبول ولی با جا برای بهتر شدن.`;
      attention.push("روی خواب و آبِ کافی تمرکز کن تا آمادگی بالا برود.");
    } else {
      readinessSentence = `میانگین آمادگی فقط ${FA(Math.round(m.avgReadiness))} از ۱۰۰ بود — هفته سنگینی بوده است.`;
      attention.push("یک جلسه ریکاوری فعال (پیاده‌روی، حرکات کششی) بین تمرین‌ها بگذار.");
    }
  }

  // ---- Nutrition ----
  let nutritionSentence = "";
  if (m.nutritionDaysLogged > 0) {
    nutritionSentence = `تغذیه در ${FA(m.nutritionDaysLogged)} روز از ۷ روز ثبت شده است.`;
    if (m.nutritionDaysLogged >= 5) highlights.push("ثبت منظم تغذیه");
  } else {
    nutritionSentence = "هیچ روزی تغذیه ثبت نشد؛ بدون داده، تحلیل تغذیه فقط حدس است.";
  }

  // ---- Weight ----
  let weightSentence = "";
  if (m.weightDeltaKg != null && Math.abs(m.weightDeltaKg) >= 0.2) {
    const dir = m.weightDeltaKg < 0 ? "کاهش" : "افزایش";
    weightSentence = `وزن ${faDecimal(Math.abs(m.weightDeltaKg))} کیلوگرم ${dir} نشان می‌دهد.`;
  }

  // ---- Focus for next week ----
  let focusFa: string;
  if (m.prs.length > 0) focusFa = "هفته آینده همان وزنه‌های رکورد را با تکرار بیشتر بزن — ثبات روی وزنه جدید، رکورد را «مال تو» می‌کند.";
  else if (attention.length > 0) focusFa = "هفته آینده یک چیز را درست کن، نه همه چیز: اولویت با نظم جلسات است.";
  else if (m.topExerciseName) focusFa = `هفته آینده روی پیشرفت کوچک در «${m.topExerciseName}» تمرکز کن — ۲٫۵ کیلوگرم یا یک تکرار بیشتر کافی است.`;
  else focusFa = "هفته آینده با دو جلسه منظم شروع کن و ست‌ها را کامل ثبت کن تا تحلیل دقیق‌تر شود.";

  // ---- Compose ----
  const content = [
    sessionSentence,
    tonnageSentence,
    prSentence,
    readinessSentence,
    nutritionSentence,
    weightSentence,
    focusFa,
  ]
    .filter(Boolean)
    .join(" ");

  if (m.streakDays >= 3) highlights.push(`استریک ${FA(m.streakDays)} روزه`);

  return { metrics: m, contentFa: content, highlights, attention };
}
