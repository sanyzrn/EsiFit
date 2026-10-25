"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { platesPerSide, warmupRamp, DEFAULT_PLATES_KG } from "@/lib/workout/progression";
import { formatNumber, toPersianDigits } from "@/lib/formatting/numbers";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

/**
 * In-session helpers shown above the set entry: what you did last time, what the
 * app suggests today (and why), a warm-up ramp and the plates to load.
 */

export type ExerciseHistoryView = {
  last: { date: string; sets: Array<{ weightKg: number | null; reps: number | null; rpe: number | null }> } | null;
  suggestion: { weightKg: number | null; reps: number | null; kind: "progress" | "repeat" | "start"; reasonFa: string } | null;
};

const fmt = (v: number) => formatNumber(v, { maximumFractionDigits: 2 });

/** One line per set group: «۸۰×۸ ، ۸۰×۸ ، ۷۷٫۵×۷». */
function summarize(sets: NonNullable<ExerciseHistoryView["last"]>["sets"]): string {
  return sets
    .map((s) => `${s.weightKg != null ? fmt(s.weightKg) : "وزن بدن"}×${s.reps != null ? toPersianDigits(s.reps) : "؟"}`)
    .join("  ·  ");
}

const KIND_STYLE: Record<string, string> = {
  progress: "border-turquoise/40 bg-turquoise/10 text-turquoise",
  repeat: "border-primary/40 bg-primary/10 text-primary",
  start: "border-border bg-surface-2 text-esi-text-secondary",
};

export function LastTimeCard({ history, onApply }: { history?: ExerciseHistoryView; onApply?: () => void }) {
  if (!history?.last && !history?.suggestion) return null;
  const s = history.suggestion;
  return (
    <div className="space-y-2">
      {history.last && (
        <p className="text-xs leading-6 text-esi-text-muted">
          <span className="font-semibold text-esi-text-secondary">دفعه قبل</span>{" "}
          <span className="tabular-nums">{summarize(history.last.sets)}</span>
        </p>
      )}
      {s && s.weightKg != null && (
        <div className={cn("flex items-center gap-3 rounded-2xl border px-4 py-3", KIND_STYLE[s.kind])} role="note">
          <Icon name={s.kind === "progress" ? "Zap" : "Target"} size={18} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold tabular-nums">
              پیشنهاد امروز: {fmt(s.weightKg)} کیلو{s.reps != null ? ` × ${toPersianDigits(s.reps)}` : ""}
            </p>
            <p className="mt-0.5 text-[11px] leading-5 text-esi-text-secondary">{s.reasonFa}</p>
          </div>
          {onApply && (
            <button
              type="button"
              onClick={onApply}
              className="shrink-0 rounded-full bg-surface-1/80 px-3 py-1.5 text-[11px] font-bold text-esi-text-primary active:scale-95"
            >
              اعمال
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ plates

const PLATE_STYLE: Record<number, { h: number; w: number; bg: string }> = {
  25: { h: 64, w: 14, bg: "var(--coral)" },
  20: { h: 60, w: 13, bg: "var(--lapis)" },
  15: { h: 54, w: 12, bg: "var(--saffron)" },
  10: { h: 46, w: 11, bg: "var(--turquoise)" },
  5: { h: 38, w: 9, bg: "var(--iris)" },
  2.5: { h: 30, w: 8, bg: "var(--text-secondary)" },
  1.25: { h: 24, w: 6, bg: "var(--text-muted)" },
};

export function PlateCalculator({ targetKg, onClose }: { targetKg: number; onClose: () => void }) {
  const reduce = useReducedMotion();
  const [bar, setBar] = React.useState(20);
  const result = platesPerSide(targetKg, bar, DEFAULT_PLATES_KG);

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-label="ماشین‌حساب صفحه هالتر"
        className="esi-card w-full max-w-md rounded-t-3xl p-6 sm:rounded-3xl"
        initial={reduce ? false : { y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl">صفحه‌های هالتر</h3>
          <button type="button" onClick={onClose} className="min-h-11 min-w-11 rounded-full text-esi-text-muted" aria-label="بستن">
            <Icon name="X" size={20} />
          </button>
        </div>
        <p className="mt-1 text-sm text-esi-text-secondary tabular-nums">
          هدف {fmt(targetKg)} کیلو — میله {toPersianDigits(bar)} کیلویی
        </p>

        {/* bar + plates, drawn like a barbell sleeve (always LTR: collar on the left) */}
        <div className="mt-6 flex h-20 items-center justify-center" dir="ltr" aria-hidden>
          <div className="h-3 w-10 rounded-s-full bg-surface-3" />
          <div className="h-5 w-2 bg-text-muted/60" />
          {result.perSide.map((p, i) => {
            const st = PLATE_STYLE[p] ?? PLATE_STYLE[2.5];
            return (
              <motion.span
                key={`${p}-${i}`}
                title={`${p} کیلو`}
                className="mx-[1px] rounded-[3px] shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]"
                style={{ height: st.h, width: st.w, background: st.bg }}
                initial={reduce ? false : { scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={{ delay: 0.05 * i, type: "spring", stiffness: 420, damping: 22 }}
              />
            );
          })}
          <div className="h-3 w-24 rounded-e-full bg-text-muted/50" />
        </div>

        <p className="mt-5 text-center text-sm font-semibold tabular-nums">
          {result.perSide.length === 0
            ? "فقط میله خالی"
            : `هر طرف: ${result.perSide.map((p) => fmt(p)).join(" + ")}`}
        </p>
        {result.remainderKg > 0 && (
          <p className="mt-1 text-center text-[11px] text-esi-text-muted tabular-nums">
            {fmt(result.remainderKg)} کیلو با صفحه‌های موجود قابل بارگذاری نیست (مجموع {fmt(result.loadedKg)}).
          </p>
        )}

        <div className="mt-5 flex items-center justify-center gap-2" role="group" aria-label="وزن میله">
          {[20, 15, 10].map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={bar === b}
              onClick={() => setBar(b)}
              className={cn(
                "min-h-10 rounded-full px-4 text-xs font-bold tabular-nums transition-colors",
                bar === b ? "bg-primary text-primary-foreground" : "bg-surface-2 text-esi-text-secondary",
              )}
            >
              میله {toPersianDigits(b)}
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ----------------------------------------------------------------- warm-up

export function WarmupHint({ workKg }: { workKg: number }) {
  const ramp = warmupRamp(workKg);
  if (ramp.length === 0) return null;
  return (
    <details className="group rounded-2xl border border-border bg-surface-2/60 px-4 py-2.5 text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-esi-text-secondary">
        <Icon name="Flame" size={14} className="text-ember" />
        گرم‌کردن پیشنهادی
        <Icon name="ChevronDown" size={14} className="ms-auto transition-transform group-open:rotate-180" />
      </summary>
      <ol className="mt-2 space-y-1.5 tabular-nums text-esi-text-secondary">
        {ramp.map((w, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-3 text-[10px] font-bold">{toPersianDigits(i + 1)}</span>
            {fmt(w.weightKg)} کیلو × {toPersianDigits(w.reps)}
          </li>
        ))}
        <li className="pt-1 text-[11px] text-esi-text-muted">استراحت بین ست‌های گرم‌کردن: ۳۰ تا ۶۰ ثانیه — ثبت‌شان لازم نیست.</li>
      </ol>
    </details>
  );
}

export { AnimatePresence };
