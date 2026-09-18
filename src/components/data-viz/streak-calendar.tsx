"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { parseISODateOnly, isoDateOnly, todayISO, persianWeekdayIndex, jalaliMonthName, toJalali } from "@/lib/dates/jalali";
import { toPersianDigits } from "@/lib/formatting/numbers";

/**
 * StreakCalendar — activity consistency heatmap on the Jalali calendar.
 * 13 weeks × 7 days grid, weeks in columns, left→right = oldest→newest
 * (LTR instrument layout; Persian weekday labels on the vertical axis).
 * Levels 0–4 by intensity. Never color-only: cells have title + legend labels.
 */

export type ActivityMap = Record<string, number>; // ISO date → intensity

function levelFor(v: number): 0 | 1 | 2 | 3 | 4 {
  if (v <= 0) return 0;
  if (v < 10) return 1;
  if (v < 25) return 2;
  if (v < 45) return 3;
  return 4;
}

const LEVEL_STYLES = [
  "bg-surface-3",
  "bg-[color-mix(in_srgb,var(--primary)_25%,var(--surface-2))]",
  "bg-[color-mix(in_srgb,var(--primary)_50%,var(--surface-2))]",
  "bg-[color-mix(in_srgb,var(--primary)_75%,var(--surface-1))]",
  "bg-primary",
];

const WEEKDAY_LABELS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

export function StreakCalendar({
  activity,
  weeks = 13,
  className,
}: {
  activity: ActivityMap;
  weeks?: number;
  className?: string;
}) {
  const today = todayISO();

  // Build grid: ends with the current week (Persian week starts Saturday)
  const todayIdx = persianWeekdayIndex(today);
  const weekEnd = today;
  const startOffset = (weeks - 1) * 7 + todayIdx;
  const start = isoDateOnly(new Date(parseISODateOnly(today).getTime() - startOffset * 86400000));

  const columns: Array<Array<{ iso: string; value: number; future: boolean }>> = [];
  for (let w = 0; w < weeks; w++) {
    const col: Array<{ iso: string; value: number; future: boolean }> = [];
    for (let d = 0; d < 7; d++) {
      const daysOut = w * 7 + d - startOffset;
      const iso = isoDateOnly(new Date(parseISODateOnly(start).getTime() + (w * 7 + d) * 86400000));
      col.push({ iso, value: activity[iso] ?? 0, future: iso > today });
    }
    columns.push(col);
  }

  // Month labels along the top (Jalali)
  const monthLabels: Array<{ col: number; label: string }> = [];
  let lastMonth = -1;
  columns.forEach((col, i) => {
    const { jm } = toJalali(parseISODateOnly(col[0].iso));
    if (jm !== lastMonth && i % 2 === 0) {
      monthLabels.push({ col: i, label: jalaliMonthName(jm) });
      lastMonth = jm;
    }
  });

  return (
    <div className={cn("w-full", className)} dir="ltr">
      {/* Month labels */}
      <div className="flex gap-[3px] mb-1 ps-7">
        {columns.map((_, i) => (
          <div key={i} className="w-3 text-[9px] text-esi-text-muted text-start relative">
            {monthLabels.find((m) => m.col === i)?.label}
          </div>
        ))}
      </div>
      <div className="flex gap-[3px]">
        {/* Weekday labels */}
        <div className="flex flex-col gap-[3px] pe-1 pt-0">
          {WEEKDAY_LABELS.map((d, i) => (
            <div key={i} className="h-3 text-[9px] leading-3 text-esi-text-muted w-4 text-center">
              {i % 2 === 0 ? d : ""}
            </div>
          ))}
        </div>
        {columns.map((col, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {col.map((cell) => (
              <div
                key={cell.iso}
                className={cn(
                  "h-3 w-3 rounded-[3px] streak-cell",
                  cell.future ? "opacity-0" : LEVEL_STYLES[levelFor(cell.value)],
                )}
                title={`${toPersianDigits(cell.iso)} — ${cell.value > 0 ? `فعالیت سطح ${toPersianDigits(levelFor(cell.value))}` : "بدون فعالیت"}`}
                role="img"
                aria-label={`${cell.iso}: ${cell.value > 0 ? `فعالیت سطح ${levelFor(cell.value)}` : "بدون فعالیت"}`}
              />
            ))}
          </div>
        ))}
      </div>
      {/* Legend — text + color */}
      <div className="mt-3 flex items-center gap-2 text-[11px] text-esi-text-muted ps-7">
        <span>کمتر</span>
        {LEVEL_STYLES.map((s, i) => (
          <span key={i} className={cn("h-2.5 w-2.5 rounded-[3px]", s)} aria-hidden />
        ))}
        <span>بیشتر</span>
      </div>
    </div>
  );
}
