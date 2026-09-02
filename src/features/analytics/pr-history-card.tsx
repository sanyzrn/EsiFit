"use client";

import * as React from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { api, errorMessage } from "@/lib/client/api";
import { toPersianDigits, formatNumber } from "@/lib/formatting/numbers";
import { formatJalaliNumeric } from "@/lib/dates/jalali";
import { cn } from "@/lib/utils";

export type PrRow = {
  id: string;
  exerciseName: string;
  value: number;
  unit: string;
  achievedAt: string;
};

type TimelinePoint = { value: number; achievedAt: string; isCurrent: boolean };

/**
 * PRHistoryCard — current records with an expandable per-exercise timeline.
 * The sparkline shows the record-breaking journey (each point = one PR).
 */
export function PRHistoryCard({ prs }: { prs: PrRow[] }) {
  const reduce = useReducedMotion();
  const [openSlug, setOpenSlug] = React.useState<string | null>(null);
  const [timeline, setTimeline] = React.useState<TimelinePoint[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const open = async (slug: string) => {
    if (openSlug === slug) {
      setOpenSlug(null);
      return;
    }
    setOpenSlug(slug);
    setTimeline(null);
    setError(null);
    setLoading(true);
    try {
      const d = await api<{ timeline: TimelinePoint[] }>(`/api/analytics/pr-history?slug=${encodeURIComponent(slug)}`);
      setTimeline(d.timeline);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ul className="space-y-2.5">
      <AnimatePresence initial={false}>
        {prs.slice(0, 6).map((pr, i) => (
          <motion.li
            key={pr.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0 : 0.3, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl bg-surface-2 overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <Icon name="Trophy" size={17} className="text-amber-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{pr.exerciseName}</p>
                <p className="text-[11px] text-esi-text-muted">{formatJalaliNumeric(pr.achievedAt)}</p>
              </div>
              <span className="text-sm font-bold tabular-nums">
                {formatNumber(pr.value, { maximumFractionDigits: 1 })}
                <span className="text-[11px] font-normal text-esi-text-muted ms-1">کیلوگرم</span>
              </span>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => void open(pr.id)} aria-expanded={openSlug === pr.id} aria-label={`تاریخچه رکورد ${pr.exerciseName}`}>
                <Icon name="ChartLine" size={15} />
              </Button>
            </div>
            <AnimatePresence initial={false}>
              {openSlug === pr.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: reduce ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="px-4 pb-4">
                    {loading && <div className="h-16 rounded-xl bg-surface-3 animate-pulse" />}
                    {error && <p className="text-xs text-destructive">{error}</p>}
                    {timeline && timeline.length < 2 && (
                      <p className="py-3 text-center text-xs text-esi-text-muted">این رکورد تازه است — با رکوردهای بعدی، روند رشد رسم می‌شود.</p>
                    )}
                    {timeline && timeline.length >= 2 && (
                      <PrSparkline points={timeline} />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function PrSparkline({ points }: { points: TimelinePoint[] }) {
  const reduce = useReducedMotion();
  const w = 300;
  const h = 64;
  const pad = 8;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = (w - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => ({
    x: pad + i * step,
    y: h - pad - ((p.value - min) / span) * (h - pad * 2),
    ...p,
  }));
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");

  return (
    <div className="pt-2" dir="ltr">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={`روند رکورد از ${formatNumber(min)} تا ${formatNumber(max)} کیلوگرم`}>
        <defs>
          <linearGradient id="prFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <motion.path
          d={`${line} L ${coords[coords.length - 1].x} ${h} L ${coords[0].x} ${h} Z`}
          fill="url(#prFill)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduce ? 0 : 0.5, delay: 0.2 }}
        />
        <motion.path
          d={line}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: reduce ? 0 : 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
        {coords.map((c, i) => (
          <motion.circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={i === coords.length - 1 ? 4 : 2.5}
            fill={i === coords.length - 1 ? "var(--primary)" : "var(--surface-3)"}
            stroke="var(--primary)"
            strokeWidth={1.5}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3 + i * 0.06, duration: reduce ? 0 : 0.2 }}
          >
            <title>{`${formatNumber(c.value)} کیلوگرم — ${formatJalaliNumeric(c.achievedAt)}`}</title>
          </motion.circle>
        ))}
      </svg>
      <p className={cn("text-[10px] text-esi-text-muted text-center mt-1", "tabular-nums")} dir="rtl">
        {toPersianDigits(points.length)} رکورد پشت سر هم • رشد {formatNumber(max - min, { maximumFractionDigits: 1 })} کیلوگرم
      </p>
    </div>
  );
}
