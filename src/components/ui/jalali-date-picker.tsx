"use client";

import * as React from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatJalaliLong, formatJalaliNumeric } from "@/lib/dates/jalali";
import { cn } from "@/lib/utils";

type JalaliDatePickerProps = {
  value: string;  // Gregorian ISO date-only, stored unchanged in APIs
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  label?: string;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
};

/** Unified, themed Persian Solar Hijri picker for all interactive date fields. */
export function JalaliDatePicker({
  value, onChange, min, max, label = "انتخاب تاریخ", compact = false,
  disabled = false, className, id,
}: JalaliDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            "flex min-w-0 items-center justify-between gap-2 rounded-xl border border-border bg-surface-2 px-3 text-sm text-esi-text-primary",
            "transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50",
            compact ? "h-10" : "h-11 w-full",
            className,
          )}
        >
          <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-center font-semibold tabular-nums">
            {compact ? formatJalaliNumeric(value) : formatJalaliLong(value)}
          </span>
          <ChevronDown className={cn("size-3.5 shrink-0 text-esi-text-muted transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        dir="rtl"
        side="bottom"
        align={compact ? "end" : "center"}
        collisionPadding={12}
        sideOffset={8}
        className="z-[100] w-[min(calc(100vw-1.25rem),23rem)] rounded-3xl border border-border bg-surface-1 p-4 text-esi-text-primary shadow-[var(--shadow-float)]"
      >
        <p className="mb-3 text-sm font-bold text-esi-text-primary">{label}</p>
        <Calendar
          value={value}
          onChange={(next) => {
            onChange(next);
            setOpen(false);
          }}
          min={min}
          max={max}
        />
      </PopoverContent>
    </Popover>
  );
}
