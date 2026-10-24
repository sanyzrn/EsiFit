import { describe, expect, it } from "vitest";
import {
  formatWorkoutDayTitle,
  formatWorkoutPlanTitle,
  PLAN_TEMPLATE_LABELS,
} from "@/lib/workout/plan-titles";

describe("Persian workout template titles", () => {
  const cases = [
    ["پُش و سینه — قدرت", "تمرین سینه و پشت"],
    ["پا — پایه", "تمرین پا"],
    ["استراحت فعال", "ریکاوری فعال"],
    ["سرشانه و بازو — حجم", "تمرین سرشانه و بازو"],
    ["بالاتنه — قدرت", "تمرین بالاتنه (قدرت)"],
    ["پایین‌تنه — قدرت", "تمرین پایین‌تنه (قدرت)"],
    ["بالاتنه — حجم", "تمرین بالاتنه (حجم)"],
    ["پایین‌تنه — حجم", "تمرین پایین‌تنه (حجم)"],
    ["استراحت", "روز استراحت"],
    ["بالاتنه — تکراربازی", "تمرین بالاتنه (تکرار بالا)"],
  ] as const;

  it.each(cases)("renames legacy day %s to %s", (source, expected) => {
    expect(formatWorkoutDayTitle(source)).toBe(expected);
    expect(formatWorkoutDayTitle(`${source} — هفته ۱`)).toBe(`${expected} | هفته اول`);
  });

  it("handles every program week, including the deload", () => {
    expect(formatWorkoutDayTitle("پا — پایه — هفته ۲")).toBe("تمرین پا | هفته دوم");
    expect(formatWorkoutDayTitle("پا — پایه — هفته ۳")).toBe("تمرین پا | هفته سوم");
    expect(formatWorkoutDayTitle("پا — پایه — هفته ۴ (دی‌لود)")).toBe("تمرین پا | هفته چهارم (کاهش فشار)");
    expect(formatWorkoutDayTitle("استراحت — هفته ۴ (دی‌لود)")).toBe("روز استراحت | هفته چهارم (کاهش فشار)");
    expect(formatWorkoutDayTitle("پا — پایه — هفته 1")).toBe("تمرین پا | هفته اول");
  });

  it("preserves coach-customized and already formatted titles", () => {
    expect(formatWorkoutDayTitle("جلسه شخصی مربی — هفته ۱")).toBe("جلسه شخصی مربی — هفته ۱");
    expect(formatWorkoutDayTitle("تمرین پا | هفته اول")).toBe("تمرین پا | هفته اول");
    expect(formatWorkoutDayTitle("تمرین آزاد")).toBe("تمرین آزاد");
  });

  it("updates legacy plan labels without changing stored data", () => {
    expect(formatWorkoutPlanTitle("برنامه شروع اسی‌فیت — پوش/پول/پا")).toBe("برنامه سه‌روزه اسی‌فیت");
    expect(formatWorkoutPlanTitle("بالاتنه/پایین‌تنه — ۴ روز")).toBe("بالاتنه و پایین‌تنه — ۵ جلسه");
    expect(formatWorkoutPlanTitle("برنامه اختصاصی مربی")).toBe("برنامه اختصاصی مربی");
  });

  it("describes the actual number of training sessions in each template", () => {
    expect(PLAN_TEMPLATE_LABELS.ppl).toContain("سه‌روزه");
    expect(PLAN_TEMPLATE_LABELS.upper_lower).toContain("۵ جلسه");
  });
});
