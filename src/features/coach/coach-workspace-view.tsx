"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/layout/app-shell";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { RevealOnScroll } from "@/components/ui/reveal-on-scroll";
import type { RosterEntry } from "@/lib/coach/data";
import { toPersianDigits, formatNumber } from "@/lib/formatting/numbers";
import { formatRelative } from "@/lib/dates/jalali";
import { READINESS_STATE_FA } from "@/lib/domain/body-math";
import { cn } from "@/lib/utils";

const READINESS_TONE: Record<string, string> = {
  ready: "text-primary bg-primary/10",
  moderate: "text-amber-500 bg-amber-500/10",
  caution: "text-amber-600 bg-amber-500/15",
  recover: "text-destructive bg-destructive/10",
};

export function CoachWorkspaceView({
  roster,
  activePlans,
  coachName,
}: {
  roster: RosterEntry[];
  activePlans: number;
  coachName: string;
}) {
  const avgAdherence =
    roster.length > 0 ? Math.round(roster.reduce((s, r) => s + r.adherencePct, 0) / roster.length) : 0;
  const alerts = roster.filter((r) => r.alertFa);
  const sessions7d = roster.reduce((s, r) => s + r.sessions7d, 0);

  return (
    <div className="max-w-6xl mx-auto w-full pb-6">
      <PageHeader
        title="ورزشکاران من"
        description={`سلام ${coachName} — تصویر امروز از فهرست ورزشکارانت`}
      />

      {/* Aggregate strip */}
      <section aria-label="خلاصه فهرست" className="px-4 lg:px-8 grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "ورزشکار فعال", value: roster.length, icon: "Users" },
          { label: "جلسات ۷ روز اخیر", value: sessions7d, icon: "Dumbbell" },
          { label: "میانگین پیوستگی", value: avgAdherence, suffix: "٪", icon: "ChartLine" },
          { label: "برنامه‌های فعال", value: activePlans, icon: "ClipboardList" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-3xl border border-border bg-surface-1 p-5"
          >
            <Icon name={s.icon} size={20} className="text-primary" />
            <p className="mt-2 text-2xl lg:text-3xl font-extrabold tabular-nums">
              <AnimatedCounter value={s.value} />
              {s.suffix ?? ""}
            </p>
            <p className="mt-1 text-[11px] text-esi-text-muted">{s.label}</p>
          </motion.div>
        ))}
      </section>

      {/* Alerts */}
      {alerts.length > 0 && (
        <section aria-label="هشدارهای مربیگری" className="px-4 lg:px-8 mb-6">
          <div className="rounded-3xl border border-amber-500/25 bg-amber-500/8 p-5">
            <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
              <Icon name="TriangleAlert" size={16} className="text-amber-500" />
              نیازمند توجه ({toPersianDigits(alerts.length)})
            </h2>
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li key={a.athleteId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{a.displayName}: <span className="text-esi-text-secondary">{a.alertFa}</span></span>
                  <Link href={`/coach/athletes/${a.athleteId}`} className="text-xs text-primary shrink-0 hover:underline">
                    پرونده ←
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Roster cards */}
      <section aria-label="فهرست ورزشکاران" className="px-4 lg:px-8 grid gap-4 md:grid-cols-2">
        {roster.map((athlete, i) => (
          <RevealOnScroll key={athlete.athleteId} delay={i * 0.04}>
            <Link
              href={`/coach/athletes/${athlete.athleteId}`}
              className="block rounded-3xl border border-border bg-surface-1 p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-[var(--shadow-raised)] hover:-translate-y-0.5 group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-11 w-11 rounded-2xl esi-gradient-brand flex items-center justify-center text-primary-foreground font-bold shrink-0">
                    {athlete.displayName.trim()[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold truncate group-hover:text-primary transition-colors">{athlete.displayName}</p>
                    <p className="text-[11px] text-esi-text-muted mt-0.5 truncate">
                      {athlete.planName ?? "بدون برنامه فعال"}
                    </p>
                  </div>
                </div>
                {athlete.readiness && (
                  <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold shrink-0", READINESS_TONE[athlete.readiness.state])}>
                    {READINESS_STATE_FA[athlete.readiness.state] ?? athlete.readiness.state} {toPersianDigits(athlete.readiness.score)}
                  </span>
                )}
              </div>

              {/* 7-day session dots */}
              <div className="mt-4 flex items-center gap-4">
                <div className="flex gap-1" aria-label={`جلسات هفته: ${athlete.sessions7d}`}>
                  {Array.from({ length: 7 }).map((_, d) => (
                    <motion.span
                      key={d}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2 + d * 0.04, type: "spring", stiffness: 300, damping: 20 }}
                      className={cn(
                        "h-2 w-2 rounded-full",
                        d < athlete.sessions7d ? "esi-gradient-brand" : "bg-surface-3",
                      )}
                    />
                  ))}
                </div>
                <span className="text-[11px] text-esi-text-muted tabular-nums">
                  {toPersianDigits(athlete.sessions7d)} جلسه این هفته
                </span>
              </div>

              {/* Adherence bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className="text-esi-text-secondary">پیوستگی ۴ هفته</span>
                  <span className="font-bold tabular-nums">{toPersianDigits(athlete.adherencePct)}٪</span>
                </div>
                <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${athlete.adherencePct}%` }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                    className={cn(
                      "h-full rounded-full",
                      athlete.adherencePct >= 70 ? "esi-gradient-brand" : athlete.adherencePct >= 40 ? "bg-amber-500" : "bg-destructive",
                    )}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-[11px] text-esi-text-muted">
                <span>
                  {athlete.lastSessionAt ? `آخرین تمرین: ${formatRelative(athlete.lastSessionAt)}` : "بدون تمرین ثبت‌شده"}
                </span>
                <span className="flex items-center gap-3 tabular-nums">
                  <span title="رکوردهای ۳۰ روز اخیر" className="flex items-center gap-1">
                    <Icon name="Trophy" size={12} className="text-amber-400" />
                    {toPersianDigits(athlete.prs30d)}
                  </span>
                  <span title="حجم ۷ روز اخیر (کیلوگرم)">
                    {formatNumber(Math.round(athlete.volume7dKg), { notation: "compact" })} kg
                  </span>
                </span>
              </div>

              {athlete.alertFa && (
                <p className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400">
                  {athlete.alertFa}
                </p>
              )}
              {!athlete.alertFa && athlete.note && (
                <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-[11px] text-esi-text-secondary">{athlete.note}</p>
              )}
            </Link>
          </RevealOnScroll>
        ))}
      </section>

      {roster.length === 0 && (
        <div className="px-4 lg:px-8">
          <div className="rounded-3xl border border-dashed border-border p-12 text-center">
            <Icon name="Users" size={32} className="mx-auto text-esi-text-muted" />
            <p className="mt-4 text-sm font-semibold">هنوز ورزشکاری به فهرست شما اضافه نشده</p>
            <p className="mt-1 text-xs text-esi-text-muted">ورزشکاران از طریق پشتیبانی به مربی متصل می‌شوند.</p>
          </div>
        </div>
      )}
    </div>
  );
}
