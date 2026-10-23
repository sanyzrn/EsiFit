import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Calendar } from "@/components/ui/calendar";
import {
  jalaliMonthLength,
  jalaliMonthName,
  jalaliToISO,
  parseISODateOnly,
  persianWeekdayIndex,
  toJalali,
} from "@/lib/dates/jalali";

describe("Solar Hijri calendar", () => {
  it("roundtrips Nowruz between Jalali and API Gregorian ISO date-only", () => {
    const iso = jalaliToISO({ jy: 1405, jm: 1, jd: 1 });
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(toJalali(parseISODateOnly(iso))).toEqual({ jy: 1405, jm: 1, jd: 1 });
  });

  it("uses correct Esfand leap-year lengths rather than Gregorian months", () => {
    expect(jalaliMonthLength(1403, 12)).toBe(30);
    expect(jalaliMonthLength(1404, 12)).toBe(29);
    expect(jalaliMonthLength(1405, 1)).toBe(31);
    expect(jalaliMonthLength(1405, 7)).toBe(30);
  });

  it("renders a Persian month/week layout without native Gregorian input", () => {
    const day = jalaliToISO({ jy: 1405, jm: 7, jd: 8 });
    const html = renderToStaticMarkup(
      React.createElement(Calendar, { value: day, onChange: () => {} }),
    );
    expect(html).toContain(jalaliMonthName(7));
    expect(html).toContain("تقویم شمسی");
    expect(html).toContain("شنبه");
    expect(html).toContain("پنجشنبه");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('data-iso="' + day + '"');
    expect(html).not.toContain('type="date"');
  });

  it("disables dates earlier than the ISO minimum and later than maximum", () => {
    const earlier = jalaliToISO({ jy: 1405, jm: 1, jd: 9 });
    const selected = jalaliToISO({ jy: 1405, jm: 1, jd: 10 });
    const later = jalaliToISO({ jy: 1405, jm: 1, jd: 11 });
    const html = renderToStaticMarkup(React.createElement(Calendar, {
      value: selected, onChange: () => {}, min: selected, max: selected,
    }));
    expect(html).toMatch(new RegExp('data-iso="' + earlier + '"[^>]*disabled'));
    expect(html).toMatch(new RegExp('data-iso="' + later + '"[^>]*disabled'));
    expect(html).toMatch(new RegExp('data-iso="' + selected + '"(?![^>]*disabled)'));
  });

  it("starts weeks on Saturday", () => {
    const iso = jalaliToISO({ jy: 1405, jm: 1, jd: 1 });
    expect(persianWeekdayIndex(iso)).toBe(0);
  });
});
