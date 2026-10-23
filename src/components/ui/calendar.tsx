"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import {
  formatJalaliLong,
  jalaliMonthLength,
  jalaliMonthName,
  jalaliToISO,
  parseISODateOnly,
  persianWeekdayIndex,
  todayISO,
  toJalali,
} from "@/lib/dates/jalali";
import { toPersianDigits } from "@/lib/formatting/numbers";
import { cn } from "@/lib/utils";

/**
 * EsiFit's only calendar implementation: Solar Hijri, Saturday-first.
 * Public values are Gregorian ISO date-only strings, matching our APIs.
 * Year, month, weekday labels and the entire visible calendar are Jalali.
 */
export type JalaliCalendarProps = {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  className?: string;
};

const WEEKDAYS = [
  { short: "ش", full: "شنبه" },
  { short: "ی", full: "یکشنبه" },
  { short: "د", full: "دوشنبه" },
  { short: "س", full: "سه‌شنبه" },
  { short: "چ", full: "چهارشنبه" },
  { short: "پ", full: "پنجشنبه" },
  { short: "ج", full: "جمعه" },
];

function monthIndex(jy: number, jm: number): number {
  return jy * 12 + jm - 1;
}

function monthFromIndex(index: number) {
  return { jy: Math.floor(index / 12), jm: index % 12 + 1 };
}

function dateParts(iso: string) {
  return toJalali(parseISODateOnly(iso));
}

export function Calendar({ value, onChange, min, max, className }: JalaliCalendarProps) {
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayISO();
  const initial = dateParts(selected);
  const [visibleMonth, setVisibleMonth] = React.useState(() => monthIndex(initial.jy, initial.jm));
  const [focusedISO, setFocusedISO] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const { jy, jm } = monthFromIndex(visibleMonth);
  const today = todayISO();

  React.useEffect(() => {
    const date = dateParts(selected);
    setVisibleMonth(monthIndex(date.jy, date.jm));
  }, [selected]);

  React.useEffect(() => {
    if (!focusedISO) return;
    rootRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${focusedISO}"]`)?.focus();
  }, [focusedISO, visibleMonth]);

  const firstWeekday = persianWeekdayIndex(jalaliToISO({ jy, jm, jd: 1 }));
  const dayCount = jalaliMonthLength(jy, jm);
  const emptyEnd = (7 - ((firstWeekday + dayCount) % 7)) % 7;
  const cells: Array<number | null> = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: dayCount }, (_, i) => i + 1),
    ...Array<null>(emptyEnd).fill(null),
  ];
  const minMonth = min ? dateParts(min) : null;
  const maxMonth = max ? dateParts(max) : null;
  const firstAllowedMonth = minMonth ? monthIndex(minMonth.jy, minMonth.jm) : monthIndex(1200, 1);
  const lastAllowedMonth = maxMonth ? monthIndex(maxMonth.jy, maxMonth.jm) : monthIndex(1500, 12);
  const startYear = minMonth ? Math.max(1200, minMonth.jy) : Math.max(1200, jy - 90);
  const endYear = maxMonth ? Math.min(1500, maxMonth.jy) : Math.min(1500, jy + 30);
  const canChooseToday = (!min || today >= min) && (!max || today <= max);

  const navigate = (delta: number) => {
    const next = visibleMonth + delta;
    if (next >= firstAllowedMonth && next <= lastAllowedMonth) setVisibleMonth(next);
  };

  const navigateFocus = (event: React.KeyboardEvent<HTMLButtonElement>, iso: string) => {
    const deltas: Record<string, number> = {
      ArrowLeft: 1,
      ArrowRight: -1,
      ArrowDown: 7,
      ArrowUp: -7,
    };
    let next: string | undefined;
    if (event.key in deltas) {
      const current = parseISODateOnly(iso);
      current.setUTCDate(current.getUTCDate() + deltas[event.key]);
      next = current.toISOString().slice(0, 10);
    } else if (event.key === "Home" || event.key === "End") {
      const current = parseISODateOnly(iso);
      const step = event.key === "Home" ? -persianWeekdayIndex(iso) : 6 - persianWeekdayIndex(iso);
      current.setUTCDate(current.getUTCDate() + step);
      next = current.toISOString().slice(0, 10);
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      const amount = event.key === "PageUp" ? -1 : 1;
      const nextMonth = monthFromIndex(visibleMonth + amount);
      if (monthIndex(nextMonth.jy, nextMonth.jm) < firstAllowedMonth ||
          monthIndex(nextMonth.jy, nextMonth.jm) > lastAllowedMonth) return;
      next = jalaliToISO({ ...nextMonth, jd: Math.min(dateParts(iso).jd, jalaliMonthLength(nextMonth.jy, nextMonth.jm)) });
    }
    if (!next || (min && next < min) || (max && next > max)) return;
    event.preventDefault();
    const p = dateParts(next);
    setVisibleMonth(monthIndex(p.jy, p.jm));
    setFocusedISO(next);
  };

  return (
    <div ref={rootRef} dir="rtl" className={cn("w-full select-none text-esi-text-primary", className)} data-slot="jalali-calendar">
      <div className="flex items-center justify-between gap-2 pb-4">
        <button
          type="button"
          aria-label="ماه قبل"
          onClick={() => navigate(-1)}
          disabled={visibleMonth <= firstAllowedMonth}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 hover:border-primary/50 disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <ChevronRight className="size-4" />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <label className="sr-only" htmlFor="jalali-calendar-month">ماه شمسی</label>
          <select
            id="jalali-calendar-month"
            value={jm}
            onChange={(event) => setVisibleMonth(monthIndex(jy, Number(event.target.value)))}
            className="h-10 min-w-0 rounded-xl border border-border bg-surface-2 px-2 text-sm font-bold text-esi-text-primary outline-none focus-visible:border-primary"
          >
            {Array.from({ length: 12 }, (_, index) => {
              const month = index + 1;
              const enabled = monthIndex(jy, month) >= firstAllowedMonth && monthIndex(jy, month) <= lastAllowedMonth;
              return <option key={month} value={month} disabled={!enabled}>{jalaliMonthName(month)}</option>;
            })}
          </select>
          <label className="sr-only" htmlFor="jalali-calendar-year">سال شمسی</label>
          <select
            id="jalali-calendar-year"
            value={jy}
            onChange={(event) => {
              const targetYear = Number(event.target.value);
              setVisibleMonth(Math.max(firstAllowedMonth, Math.min(lastAllowedMonth, monthIndex(targetYear, jm))));
            }}
            className="h-10 rounded-xl border border-border bg-surface-2 px-2 text-sm font-bold tabular-nums text-esi-text-primary outline-none focus-visible:border-primary"
          >
            {Array.from({ length: Math.max(0, endYear - startYear + 1) }, (_, index) => {
              const year = startYear + index;
              return <option key={year} value={year}>{toPersianDigits(year)}</option>;
            })}
          </select>
        </div>
        <button
          type="button"
          aria-label="ماه بعد"
          onClick={() => navigate(1)}
          disabled={visibleMonth >= lastAllowedMonth}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 hover:border-primary/50 disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`تقویم شمسی ${jalaliMonthName(jm)} ${toPersianDigits(jy)}`}>
        {WEEKDAYS.map(({ short, full }) => (
          <div key={short} role="columnheader" title={full} className="flex h-9 items-center justify-center text-xs font-semibold text-esi-text-muted">
            {short}
          </div>
        ))}
        {cells.map((day, index) => {
          if (day === null) return <div role="gridcell" aria-disabled key={`blank-${index}`} className="h-10" />;
          const iso = jalaliToISO({ jy, jm, jd: day });
          const disabled = Boolean((min && iso < min) || (max && iso > max));
          const isSelected = selected === iso;
          const isToday = today === iso;
          return (
            <div key={iso} role="gridcell" aria-selected={isSelected} className="min-w-0">
              <button
                type="button"
                data-iso={iso}
                onClick={() => onChange(iso)}
                onKeyDown={(event) => navigateFocus(event, iso)}
                disabled={disabled}
                title={formatJalaliLong(iso)}
                aria-label={`${formatJalaliLong(iso)}${isToday ? "، امروز" : ""}`}
                aria-pressed={isSelected}
                className={cn(
                  "relative flex h-10 w-full items-center justify-center rounded-xl text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
                  isSelected ? "bg-primary font-extrabold text-primary-foreground shadow-sm"
                    : "hover:bg-surface-3 text-esi-text-primary",
                  isToday && !isSelected && "border border-primary/60 text-primary font-bold",
                  disabled && "opacity-25 cursor-not-allowed hover:bg-transparent",
                )}
              >
                {toPersianDigits(day)}
                {isToday && !isSelected && <span aria-hidden className="absolute bottom-1 size-1 rounded-full bg-primary" />}
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-esi-text-muted">
          <CalendarDays className="size-4" />
          {formatJalaliLong(selected)}
        </span>
        <button
          type="button"
          onClick={() => {
            const p = dateParts(today);
            setVisibleMonth(monthIndex(p.jy, p.jm));
            onChange(today);
          }}
          disabled={!canChooseToday}
          className="min-h-9 shrink-0 rounded-xl bg-surface-2 px-3 text-xs font-bold text-primary hover:bg-surface-3 disabled:opacity-35"
        >
          امروز
        </button>
      </div>
    </div>
  );
}
