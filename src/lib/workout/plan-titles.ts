/**
 * Human-readable Persian titles for generated workout plans.
 * Kept separate from DB/template code so existing saved days and sessions can
 * be displayed correctly without regenerating programs or changing user data.
 */

export const PLAN_TEMPLATE_LABELS = {
  ppl: "سه‌روزه: سینه و پشت، پا، سرشانه و بازو",
  upper_lower: "بالاتنه و پایین‌تنه: ۵ جلسه",
} as const;

const DAY_LABELS: Record<string, string> = {
  "پُش و سینه — قدرت": "تمرین سینه و پشت",
  "پا — پایه": "تمرین پا",
  "استراحت فعال": "ریکاوری فعال",
  "سرشانه و بازو — حجم": "تمرین سرشانه و بازو",
  "بالاتنه — قدرت": "تمرین بالاتنه (قدرت)",
  "پایین‌تنه — قدرت": "تمرین پایین‌تنه (قدرت)",
  "بالاتنه — حجم": "تمرین بالاتنه (حجم)",
  "پایین‌تنه — حجم": "تمرین پایین‌تنه (حجم)",
  "استراحت": "روز استراحت",
  "بالاتنه — تکراربازی": "تمرین بالاتنه (تکرار بالا)",
};

const WEEK_NAMES: Record<string, string> = {
  "1": "اول", "۱": "اول",
  "2": "دوم", "۲": "دوم",
  "3": "سوم", "۳": "سوم",
  "4": "چهارم", "۴": "چهارم",
};

const LEGACY_PLAN_LABELS: Record<string, string> = {
  "برنامه شروع اسی‌فیت — پوش/پول/پا": "برنامه سه‌روزه اسی‌فیت",
  "بالاتنه/پایین‌تنه — ۴ روز": "بالاتنه و پایین‌تنه — ۵ جلسه",
};

/** Rewrite only known system template titles; never change a coach's custom title. */
export function formatWorkoutDayTitle(name: string): string {
  const match = /^(.*?)\s*—\s*هفته\s*([1-4۱-۴])(\s*\(دی‌لود\))?$/.exec(name);
  if (!match) return DAY_LABELS[name] ?? name;

  const [, base, week, deload] = match;
  const label = DAY_LABELS[base];
  if (!label) return name;
  const recoveryDay = base === "استراحت" || base === "استراحت فعال";
  return `${label} | هفته ${WEEK_NAMES[week]}${deload && !recoveryDay ? " (کاهش فشار)" : ""}`;
}

/** Legacy program names are also fixed at display time, with no DB migration. */
export function formatWorkoutPlanTitle(name: string): string {
  return LEGACY_PLAN_LABELS[name] ?? name;
}
