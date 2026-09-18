"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { PageHeader } from "@/components/layout/app-shell";
import { MuscleBody, type Gender } from "@/components/data-viz/anatomy/muscle-body";
import { StreakCalendar } from "@/components/data-viz/streak-calendar";
import { BodyRadar } from "@/components/data-viz/body-radar";
import { EsiScoreDial } from "@/components/data-viz/esi-score-dial";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/ui/icon";
import { api, errorMessage } from "@/lib/client/api";
import { cacheGet, cachePut } from "@/lib/offline/adapter";
import { useFeatureFlag } from "@/lib/feature-flags/flag-provider";
import { useSession } from "@/lib/client/use-session";
import { getEntitlements, type UserTier } from "@/lib/entitlements/entitlements";
import { formatNumber, toPersianDigits, formatDelta } from "@/lib/formatting/numbers";
import { formatJalaliLong, formatRelative } from "@/lib/dates/jalali";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { GoalsSection, type GoalCard } from "@/features/analytics/goals-section";
import { InsightsCard } from "@/features/analytics/insights-card";
import { WeeklyRecapCard } from "@/features/analytics/weekly-recap-card";
import { PRHistoryCard } from "@/features/analytics/pr-history-card";
import type { Insight } from "@/lib/domain/plateau";
import type { EsiScoreResult } from "@/lib/domain/esi-score";
import { cn } from "@/lib/utils";

type AnalyticsData = {
  muscleVolume: Record<string, number>;
  radar: Array<{ pattern: string; value: number }>;
  activity: Record<string, number>;
  weightTrend: Array<{ date: string; weight: number | null; bodyFat: number | null }>;
  weeklyVolume: Array<{ weekStart: string; volume: number }>;
  prs: Array<{ id: string; exerciseName: string; exerciseSlug?: string; value: number; unit: string; achievedAt: string }>;
  totals: { sessions: number; volumeKg: number };
  insights: Insight[];
  esiScore: EsiScoreResult | null;
  entitlements?: { advancedAnalytics: boolean; historyMonths: number };
  goals: GoalCard[];
  strengthTrend: Array<{ exerciseSlug: string; exerciseName: string; points: Array<{ date: string; best: number }> }>;
};

const PATTERN_FA: Record<string, string> = {
  horizontal_push: "پرس افقی",
  vertical_push: "پرس عمودی",
  horizontal_pull: "کشش افقی",
  vertical_pull: "کشش عمودی",
  squat: "اسکوات",
  hinge: "هینج",
  core: "میان‌تنه",
};

export function AnalyticsView() {
  const [data, setData] = React.useState<AnalyticsData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [gender, setGender] = React.useState<Gender>("male");
  const session = useSession();
  const router = useRouter();
  const reduce = useReducedMotion();
  const heatFlag = useFeatureFlag("MUSCLE_HEATMAP");
  const prFlag = useFeatureFlag("PERSONAL_RECORDS");
  const esiFlag = useFeatureFlag("ESISCORE");
  const plateauFlag = useFeatureFlag("PLATEAU_DETECTOR");
  const goalFlag = useFeatureFlag("GOAL_ENGINE");
  const recapFlag = useFeatureFlag("WEEKLY_RECAP");
  const ent = getEntitlements((session?.tier ?? "free") as UserTier);

  const load = React.useCallback(() => {
    (async () => {
      try {
        const res = await api<AnalyticsData>("/api/analytics/overview");
        setData(res);
        void cachePut("analytics", res);
      } catch (e) {
        const cached = await cacheGet<AnalyticsData>("analytics");
        if (cached) {
          setData(cached);
          return;
        }
        setError(errorMessage(e));
      }
    })();
  }, []);

  React.useEffect(load, [load]);

  const weightChartData = (data?.weightTrend ?? []).map((m) => ({
    date: m.date,
    weight: m.weight,
  }));

  const volumeChartData = (data?.weeklyVolume ?? []).slice(-8).map((w) => ({
    label: formatJalaliLong(w.weekStart).split(" ").slice(1).join(" "),
    volume: Math.round(w.volume / 100) / 10,
  }));

  return (
    <div className="max-w-6xl mx-auto w-full pb-6">
      <PageHeader title="تحلیل پیشرفت" description="تصویر واقعی از ۹۰ روز تمرین شما — بدون عدد تزئینی." />

      {error && (
        <div role="alert" className="mx-4 lg:mx-8 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!data ? (
        <div className="px-4 lg:px-8 grid gap-5">
          <Skeleton className="h-72 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-56 rounded-3xl" />
        </div>
      ) : (
        <div className="px-4 lg:px-8 space-y-5">
          {/* headline stats */}
          <section aria-label="خلاصه آمار" className="grid grid-cols-3 gap-3">
            {[
              { label: "جلسات تمرین", value: data.totals.sessions, icon: "Dumbbell" },
              { label: "حجم کل (تُن)", value: Math.round(data.totals.volumeKg / 100) / 10, icon: "Mountain", suffix: "" },
              { label: "رکوردهای فعال", value: data.prs.length, icon: "Trophy" },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-3xl border border-border bg-surface-1 p-5 text-center"
              >
                <Icon name={s.icon} size={20} className="text-primary mx-auto" />
                <p className="mt-2 text-2xl lg:text-3xl font-extrabold tabular-nums">
                  <AnimatedCounter value={s.value} format="decimal" digits={1} />
                </p>
                <p className="mt-1 text-[11px] text-esi-text-muted">{s.label}</p>
              </motion.div>
            ))}
          </section>

          {/* EsiScore — composite, explainable (VIP server-enforced) */}
          {esiFlag && data.esiScore && (
            <motion.section
              aria-label="امتیاز اسی"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative overflow-hidden rounded-3xl border border-border bg-surface-1 p-6"
            >
              <div className="pointer-events-none absolute -top-20 -start-20 h-56 w-56 rounded-full bg-primary/8 blur-3xl" aria-hidden />
              <div className="relative">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <h2 className="font-bold">امتیاز اسی</h2>
                    <p className="text-xs text-esi-text-secondary mt-1">ترکیب وزن‌دار پیوستگی، قدرت، حجم، ریکاوری و تغذیه — شفاف و قابل‌توضیح</p>
                  </div>
                  <span className="rounded-full bg-surface-2 px-3 py-1.5 text-[11px] text-esi-text-muted shrink-0">۹۰ روز اخیر</span>
                </div>
                <EsiScoreDial score={data.esiScore} />
              </div>
            </motion.section>
          )}
          {esiFlag && !data.esiScore && !ent.advancedAnalytics && (
            <section aria-label="امتیاز اسی" className="rounded-3xl border border-border bg-surface-1 p-6">
              <h2 className="font-bold mb-2">امتیاز اسی</h2>
              <p className="text-sm leading-6 text-esi-text-secondary">
                امتیاز اسی و تحلیل‌های پیشرفته از پلن وی‌آی‌پی فعال می‌شوند.{" "}
                <a href="/plans" className="text-primary font-medium">ارتقای پلن</a>
              </p>
            </section>
          )}

          {/* Muscle heat map — anatomy on real geometry */}
          {heatFlag && (
            <section aria-label="نقشه حرارتی عضلات" className="rounded-3xl border border-border bg-surface-1 p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="font-bold">نقشه حرارتی عضلات</h2>
                  <p className="text-xs text-esi-text-secondary mt-1">حجم تمرینی ۳۰ روز گذشته بر اساس شدت درگیری هر عضله</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded-full bg-surface-2 p-1" role="group" aria-label="نوع آناتومی">
                    {(["male", "female"] as Gender[]).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGender(g)}
                        aria-pressed={gender === g}
                        className={cn(
                          "relative rounded-full px-3 py-1 text-[11px] font-semibold transition-colors",
                          gender === g ? "text-primary-foreground" : "text-esi-text-secondary hover:text-esi-text-primary",
                        )}
                      >
                        {gender === g && (
                          <motion.span layoutId="heat-gender-pill" className="absolute inset-0 rounded-full bg-primary" transition={{ type: "spring", stiffness: 420, damping: 32 }} aria-hidden />
                        )}
                        <span className="relative z-10">{g === "male" ? "مرد" : "زن"}</span>
                      </button>
                    ))}
                  </div>
                  <span className="hidden sm:block rounded-full bg-surface-2 px-3 py-1.5 text-[11px] text-esi-text-muted">۳۰ روز اخیر</span>
                </div>
              </div>
              <MuscleBody mode="display" intensity={data.muscleVolume} gender={gender} height={300} />
            </section>
          )}

          {/* Insights */}
          {plateauFlag && <InsightsCard insights={data.insights} />}

          {/* Goals */}
          {goalFlag && <GoalsSection goals={data.goals} onChanged={load} />}

          {/* Weekly recap */}
          {recapFlag && (
            <WeeklyRecapCard
              locked={!ent.weeklyRecap}
              onLockedCta={() => router.push("/plans")}
            />
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Weight trend — gradient area */}
            <section aria-label="روند وزن" className="rounded-3xl border border-border bg-surface-1 p-6">
              <h2 className="font-bold mb-1">روند وزن</h2>
              <p className="text-xs text-esi-text-secondary mb-4">
                {data.weightTrend.length > 1
                  ? `${formatDelta(data.weightTrend[data.weightTrend.length - 1].weight! - data.weightTrend[0].weight!)} کیلوگرم از اولین ثبت`
                  : "داده کافی برای روند موجود نیست"}
              </p>
              {weightChartData.length >= 2 ? (
                <div dir="ltr">
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={weightChartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                      <defs>
                        <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                        tickFormatter={(d: string) => toPersianDigits(formatJalaliLong(d).split(" ").slice(0, 2).join(" "))}
                        tickLine={false}
                        axisLine={{ stroke: "var(--border)" }}
                      />
                      <YAxis
                        tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                        domain={["dataMin - 1", "dataMax + 1"]}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => toPersianDigits(v)}
                      />
                      <Tooltip
                        contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontFamily: "inherit", direction: "rtl" }}
                        labelFormatter={(d: string) => formatJalaliLong(d)}
                        formatter={(v: number) => [`${toPersianDigits(v)} کیلوگرم`, "وزن"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="weight"
                        stroke="var(--chart-1)"
                        strokeWidth={2.5}
                        fill="url(#weightFill)"
                        dot={false}
                        activeDot={{ r: 5, fill: "var(--chart-1)", stroke: "var(--surface-1)", strokeWidth: 2 }}
                        animationDuration={reduce ? 0 : 900}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-esi-text-muted">حداقل دو اندازه‌گیری برای نمودار لازم است</p>
              )}
            </section>

            {/* Strength radar */}
            <section aria-label="رادار قدرت" className="rounded-3xl border border-border bg-surface-1 p-6">
              <h2 className="font-bold mb-1">رادار قدرت نسبی</h2>
              <p className="text-xs text-esi-text-secondary mb-2">بیشینه تخمینی هر الگوی حرکتی نسبت به قوی‌ترین الگوی شما</p>
              <BodyRadar data={data.radar.map((r) => ({ ...r, pattern: PATTERN_FA[r.pattern] ?? r.pattern }))} />
            </section>
          </div>

          {/* Streak calendar */}
          <section aria-label="تقویم پیوستگی" className="rounded-3xl border border-border bg-surface-1 p-6 overflow-x-auto">
            <h2 className="font-bold mb-1">تقویم پیوستگی</h2>
            <p className="text-xs text-esi-text-secondary mb-4">۱۳ هفته اخیر — تمرین و ثبت آب روزانه</p>
            <StreakCalendar activity={data.activity} />
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Weekly volume */}
            <section aria-label="حجم هفتگی" className="rounded-3xl border border-border bg-surface-1 p-6">
              <h2 className="font-bold mb-4">حجم تمرینی هفتگی (تُن)</h2>
              {volumeChartData.some((v) => v.volume > 0) ? (
                <div dir="ltr">
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={volumeChartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="volBar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 9 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={0} angle={-35} height={44} textAnchor="end" />
                      <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => toPersianDigits(v)} />
                      <Tooltip
                        contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, direction: "rtl", fontFamily: "inherit" }}
                        formatter={(v: number) => [`${toPersianDigits(v)} تُن`, "حجم"]}
                        cursor={{ fill: "color-mix(in srgb, var(--primary) 6%, transparent)" }}
                      />
                      <Bar dataKey="volume" fill="url(#volBar)" radius={[6, 6, 0, 0]} maxBarSize={26} animationDuration={reduce ? 0 : 700} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-esi-text-muted">با ثبت تمرین‌ها، نمودار حجم ساخته می‌شود</p>
              )}
            </section>

            {/* PRs with history */}
            {prFlag && (
              <section aria-label="رکوردهای شخصی" className="rounded-3xl border border-border bg-surface-1 p-6">
                <h2 className="font-bold mb-4">رکوردهای شخصی فعال</h2>
                {data.prs.length === 0 ? (
                  <p className="py-8 text-center text-sm text-esi-text-muted">
                    با ثبت ست‌های سنگین، رکوردها خودکار تشخیص داده می‌شوند
                  </p>
                ) : (
                  <PRHistoryCard prs={data.prs} />
                )}
                {!ent.advancedAnalytics && (
                  <p className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-[11px] leading-5 text-esi-text-secondary">
                    <a href="/plans" className="text-primary font-medium">ارتقای پلن</a> برای تحلیل عمیق‌تر روند قدرت و پیش‌بینی.
                  </p>
                )}
              </section>
            )}
          </div>

          {/* Strength trend sparklines */}
          {data.strengthTrend.length > 0 && (
            <section aria-label="روند قدرت حرکات" className="rounded-3xl border border-border bg-surface-1 p-6">
              <h2 className="font-bold mb-1">روند بیشینه تخمینی</h2>
              <p className="text-xs text-esi-text-secondary mb-4">هر نقطه، بهترین ست آن حرکت در یک جلسه است (مدل Epley/Brzycki)</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.strengthTrend.map((t, i) => {
                  const first = t.points[0].best;
                  const last = t.points[t.points.length - 1].best;
                  const gain = last - first;
                  return (
                    <motion.div
                      key={t.exerciseSlug}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.05, duration: reduce ? 0 : 0.35 }}
                      className="rounded-2xl bg-surface-2 p-4"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-xs font-bold truncate">{t.exerciseName}</p>
                        <span className={cn("text-[11px] font-bold tabular-nums shrink-0", gain > 0 ? "text-primary" : "text-esi-text-muted")}>
                          {gain > 0 ? "+" : ""}
                          {formatNumber(gain, { maximumFractionDigits: 1 })} کیلوگرم
                        </span>
                      </div>
                      <MiniSpark points={t.points.map((p) => p.best)} />
                      <p className="mt-1.5 text-[10px] text-esi-text-muted">{toPersianDigits(t.points.length)} جلسه</p>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function MiniSpark({ points }: { points: number[] }) {
  const reduce = useReducedMotion();
  if (points.length < 2) return <div className="h-10 rounded-lg bg-surface-3" aria-hidden />;
  const w = 200;
  const h = 40;
  const pad = 4;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = (w - pad * 2) / (points.length - 1);
  const coords = points.map((v, i) => ({ x: pad + i * step, y: h - pad - ((v - min) / span) * (h - pad * 2) }));
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" aria-hidden>
      <motion.path
        d={line}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: reduce ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

// formatRelative kept for parity with completion surfaces.
void formatRelative;
