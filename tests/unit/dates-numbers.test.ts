import { describe, it, expect } from "vitest";
import { parseISODateOnly, addDaysISO, daysBetweenISO, isoDateOnly, todayISO, toJalali } from "@/lib/dates/jalali";
import { toPersianDigits, toLatinDigits, parseLocaleNumber, formatClock, formatToman } from "@/lib/formatting/numbers";
import { normalizeIranMobile } from "@/lib/auth/otp";

describe("jalali dates", () => {
  it("parses date-only and full ISO timestamps identically", () => {
    const a = parseISODateOnly("2026-08-26");
    const b = parseISODateOnly("2026-08-26T17:30:00.000Z");
    expect(isoDateOnly(a)).toBe("2026-08-26");
    expect(isoDateOnly(b)).toBe("2026-08-26");
  });
  it("addDaysISO crosses month boundaries", () => {
    expect(addDaysISO("2026-03-30", 5)).toBe("2026-04-04");
    expect(addDaysISO("2026-01-01", -1)).toBe("2025-12-31");
  });
  it("daysBetweenISO measures a-b", () => {
    expect(daysBetweenISO("2026-08-26", "2026-08-20")).toBe(6);
    expect(daysBetweenISO("2026-08-20", "2026-08-26")).toBe(-6);
  });
  it("todayISO is a valid date-only string", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("toJalali roundtrips through known date", () => {
    const j = toJalali(new Date("2026-03-21T00:00:00Z"));
    expect(j.jy).toBeGreaterThan(1400);
  });
});

describe("persian numbers", () => {
  it("converts digits both ways", () => {
    expect(toPersianDigits("123")).toBe("۱۲۳");
    expect(toLatinDigits("۱۲۳")).toBe("123");
  });
  it("parses Persian decimal input (٫ and arabic decimal)", () => {
    expect(parseLocaleNumber("۴۰٫۵")).toBeCloseTo(40.5, 5);
    expect(parseLocaleNumber("80")).toBe(80);
    expect(parseLocaleNumber("")).toBeNull();
  });
  it("formats clock m:ss", () => {
    expect(formatClock(65)).toBe("۱:۰۵");
    expect(formatClock(600)).toBe("۱۰:۰۰");
  });
  it("formats toman with separators", () => {
    expect(formatToman(25000)).toContain("تومان");
  });
});

describe("iran mobile normalization", () => {
  it("accepts common formats", () => {
    expect(normalizeIranMobile("09120000000")).toBe("09120000000");
    expect(normalizeIranMobile("+989120000000")).toBe("09120000000");
    expect(normalizeIranMobile("00989120000000")).toBe("09120000000");
    expect(normalizeIranMobile("۹۸۹۱۲۰۰۰۰۰۰۰")).toBe("09120000000");
    expect(normalizeIranMobile("0 912 000 0000")).toBe("09120000000");
  });
  it("rejects invalid numbers", () => {
    expect(normalizeIranMobile("12345")).toBeNull();
    expect(normalizeIranMobile("01234567890")).toBeNull(); // landline pattern
    expect(normalizeIranMobile("")).toBeNull();
  });
});
