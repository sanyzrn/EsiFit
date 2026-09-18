"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { RecoveryOrb, type ReadinessFactor } from "@/components/data-viz/recovery-orb";
import { MacroRingGroup } from "@/components/data-viz/macro-rings";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/ui/icon";
import { api, errorMessage } from "@/lib/client/api";
import { cacheGet, cachePut, enqueueOperation, newClientId } from "@/lib/offline/adapter";
import { useSession } from "@/lib/client/use-session";
import { useFeatureFlag } from "@/lib/feature-flags/flag-provider";
import { formatJalaliWeekdayDay, todayISO } from "@/lib/dates/jalali";
import { formatNumber, formatDelta, toPersianDigits } from "@/lib/formatting/numbers";
import { TIER_LABELS, type UserTier } from "@/lib/entitlements/entitlements";
import { cn } from "@/lib/utils";

type DashboardData = {
  greetingName: string;
  tier: string;
  today: string;
  readiness: { score: number; state: string; isEstimated: boolean; factors: ReadinessFactor[] } | null;
  todayWorkout: { planDayId: string; name: string; isRest: boolean; exerciseCount: number; estimatedMinutes: number } | null;
  activeSession: { id: string; name: string } | null;
  nutrition: {
    totals: { calories: number; proteinG: number; carbsG: number; fatG: number };
    targets: { calories: number; proteinG: number; carbsG: number; fatG: number } | null;
    entryCount: number;
  };
  water: { ml: number; targetMl: number };
  weight: { current: number; deltaFromStart: number } | null;
  gamification: { xp: number; level: number; levelProgress: number; streakDays: number };
  coachGuidance: {
    tone: "push" | "maintain" | "adjust" | "recover" | "return";
    volumeModifierPercent: number;
    messageFa: string;
    cueFa: string;
    avoidMaxAttempts: boolean;
  } | null;
  goals: Array<{ id: string; title: string; percent: number; statusFa: string }>;
};

/**
 * DashboardView — priority: Greeting → Today → Progress/Readiness → Action → History.
 * Offline: hydrates from IndexedDB cache, mutations queue safely.
 */
export function DashboardView() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [waterBusy, setWaterBusy] = React.useState(false);
  const session = useSession();
  const router = useRouter();
  const readinessFlag = useFeatureFlag("READINESS_SCORE");
  const offlineFlag = useFeatureFlag("OFFLINE_TRACKERS");
  const coachFlag = useFeatureFlag("ADAPTIVE_COACH");
  const goalFlag = useFeatureFlag("GOAL_ENGINE");

  const load = React.useCallback(async () => {
    try {
      const res = await api<DashboardData>("/api/dashboard");
      setData(res);
      void cachePut("dashboard", res);
    } catch (e) {
      const cached = await cacheGet<DashboardData>("dashboard");
      if (cached) {
        setData(cached);
        return;
      }
      setError(errorMessage(e));
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const addWater = async (ml: number) => {
    setWaterBusy(true);
    const clientId = newClientId("water");
    const op = { clientId, kind: "water" as const, endpoint: "/api/water", payload: { ml, clientId } };
    try {
      await api("/api/water", { method: "POST", json: { ml, clientId } });
      setData((d) =>
        d ? { ...d, water: { ...d.water, ml: d.water.ml + ml } } : d,
      );
    } catch (e) {
      if (offlineFlag) {
        await enqueueOperation(op);
        setData((d) => (d ? { ...d, water: { ...d.water, ml: d.water.ml + ml } } : d));
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setWaterBusy(false);
    }
  };

  const startWorkout = async () => {
    try {
      const payload = data?.todayWorkout?.planDayId
        ? { planDayId: data.todayWorkout.planDayId }
        : {};
      const res = await api<{ session: { id: string } }>("/api/workouts/sessions", { method: "POST", json: payload });
      router.push(`/workout/live?session=${res.session.id}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 5 ? "شب‌بخیر" : hour < 12 ? "صبح بخیر" : hour < 17 ? "وقت بخیر" : "شب بخیر";
  const waterPct = data ? Math.min(100, Math.round((data.water.ml / data.water.targetMl) * 100)) : 0;

  return (
    <div className="px-4 lg:px-8 pt-6 max-w-6xl mx-auto w-full space-y-6">
      {/* ---- Greeting ---- */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-esi-text-muted">{formatJalaliWeekdayDay(new Date())}</p>
          <h1 className="mt-1 text-2xl lg:text-3xl font-bold tracking-tight">
            {greeting}، <span className="esi-gradient-brand-text">{data?.greetingName ?? session?.displayName ?? ""}</span> 👋
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-1 px-3 py-1.5 text-xs text-esi-text-secondary">
            <span className="text-base leading-none" aria-hidden>🔥</span>
            <AnimatedCounter value={data?.gamification.streakDays ?? 0} className="tabular-nums font-semibold" />
            روز زنجیره
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-1 px-3 py-1.5 text-xs text-esi-text-secondary">
            سطح {toPersianDigits(data?.gamification.level ?? 1)}
            <span className="font-semibold text-primary">{TIER_LABELS[(session?.tier ?? "free") as UserTier]}</span>
          </span>
        </div>
      </header>

      {error && (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive flex items-center justify-between gap-3">
          {error}
          <Button variant="ghost" size="sm" className="h-8" onClick={() => void load()}>تلاش دوباره</Button>
        </div>
      )}

      {!data ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* ---- Main grid: priority = Today → Readiness → Nutrition → Water ---- */}
          <div className="grid gap-5 lg:grid-cols-3">
            {/* Today workout — action card */}
            <motion.section
              aria-label="تمرین امروز"
              className="lg:col-span-2 rounded-3xl border border-border bg-surface-1 p-6 relative overflow-hidden"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <div aria-hidden className="absolute -top-16 -start-16 h-48 w-48 rounded-full bg-mint-400/6 blur-3xl" />
              <div className="flex items-start justify-between gap-4 relative">
                <div>
                  <p className="text-xs font-semibold text-primary">امروز</p>
                  <h2 className="mt-1 text-xl font-bold">
                    {data.activeSession ? "تمرین نیمه‌تمام دارید!" : data.todayWorkout?.isRest ? "روز استراحت فعال" : data.todayWorkout?.name ?? "تمرین آزاد"}
                  </h2>
                  {data.todayWorkout && !data.activeSession && (
                    <p className="mt-1 text-sm text-esi-text-secondary">
                      {data.todayWorkout.isRest
                        ? "پیاده‌روی سبک یا کشش — بدن امروز در حال بازسازی است."
                        : `${toPersianDigits(data.todayWorkout.exerciseCount)} حرکت • حدود ${toPersianDigits(data.todayWorkout.estimatedMinutes)} دقیقه`}
                    </p>
                  )}
                  {data.activeSession && (
                    <p className="mt-1 text-sm text-esi-text-secondary">
                      جلسه «{data.activeSession.name}» در جریان است — ادامه دهید.
                    </p>
                  )}
                </div>
                <div className="h-14 w-14 rounded-2xl bg-surface-2 flex items-center justify-center text-2xl shrink-0" aria-hidden>
                  {data.todayWorkout?.isRest ? "🧘" : "🏋️"}
                </div>
              </div>
              {coachFlag && data.coachGuidance && (
                <CoachGuidanceChip
                  tone={data.coachGuidance.tone}
                  messageFa={data.coachGuidance.messageFa}
                  cueFa={data.coachGuidance.cueFa}
                  volumeModifierPercent={data.coachGuidance.volumeModifierPercent}
                />
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                {data.activeSession ? (
                  <Button asChild className="h-11 px-6">
                    <Link href={`/workout/live?session=${data.activeSession.id}`}>ادامه تمرین</Link>
                  </Button>
                ) : data.todayWorkout?.isRest ? (
                  <Button asChild variant="secondary" className="h-11 px-6">
                    <Link href="/workouts">انتخاب تمرین دلخواه</Link>
                  </Button>
                ) : (
                  <Button className="h-11 px-6 esi-glow" onClick={() => void startWorkout()}>
                    شروع تمرین
                  </Button>
                )}
                <Button asChild variant="ghost" className="h-11">
                  <Link href="/workouts">برنامه‌ها</Link>
                </Button>
              </div>
            </motion.section>

            {/* Readiness */}
            {readinessFlag && (
              <motion.section
                aria-label="آمادگی امروز"
                className="rounded-3xl border border-border bg-surface-1 p-6 flex flex-col items-center justify-center"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              >
                {data.readiness ? (
                  <>
                    <RecoveryOrb
                      score={data.readiness.score}
                      state={data.readiness.state as "ready" | "moderate" | "caution" | "recover"}
                      factors={data.readiness.factors}
                      isEstimated={data.readiness.isEstimated}
                      size={170}
                    />
                    <Link href="/analytics" className="mt-3 text-xs text-esi-text-muted hover:text-esi-text-primary transition-colors">
                      تحلیل کامل پیشرفت ←
                    </Link>
                  </>
                ) : (
                  <p className="text-sm text-esi-text-muted">داده کافی برای محاسبه آمادگی نیست</p>
                )}
              </motion.section>
            )}

            {/* Nutrition */}
            <motion.section
              aria-label="تغذیه امروز"
              className="lg:col-span-2 rounded-3xl border border-border bg-surface-1 p-6"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold">تغذیه امروز</h2>
                <Link href="/nutrition" className="text-xs text-esi-text-muted hover:text-esi-text-primary transition-colors flex items-center gap-1">
                  ثبت وعده
                  <Icon name="ChevronLeft" size={14} />
                </Link>
              </div>
              <MacroRingGroup totals={data.nutrition.totals} targets={data.nutrition.targets} />
              {data.nutrition.entryCount === 0 && (
                <p className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-xs text-esi-text-secondary">
                  هنوز چیزی ثبت نشده — اولین وعده را از صفحه تغذیه اضافه کنید.
                </p>
              )}
            </motion.section>

            {/* Water quick-add */}
            <motion.section
              aria-label="آب روزانه"
              className="rounded-3xl border border-border bg-surface-1 p-6 flex flex-col"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2 className="font-bold mb-4">آب امروز</h2>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-extrabold tabular-nums">
                    <AnimatedCounter value={Math.round(data.water.ml / 100) / 10} format="decimal" digits={1} />
                    <span className="text-sm font-medium text-esi-text-muted ms-1">لیتر</span>
                  </p>
                  <p className="text-xs text-esi-text-muted mt-1">هدف {formatNumber(data.water.targetMl / 1000, { maximumFractionDigits: 1 })} لیتر</p>
                </div>
                <WaterGlass pct={waterPct} />
              </div>
              <div className="mt-4 h-2 rounded-full bg-surface-3 overflow-hidden" role="progressbar" aria-valuenow={waterPct} aria-valuemin={0} aria-valuemax={100} aria-label="درصد آب مصرفی">
                <motion.div
                  className="h-full rounded-full bg-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${waterPct}%` }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[250, 500, 750].map((ml) => (
                  <button
                    key={ml}
                    type="button"
                    disabled={waterBusy}
                    onClick={() => void addWater(ml)}
                    className="min-h-11 rounded-xl border border-border bg-surface-2 text-sm font-medium tabular-nums transition-all duration-150 hover:border-blue-500/50 active:scale-95 disabled:opacity-50"
                  >
                    +{toPersianDigits(ml)}
                  </button>
                ))}
              </div>
            </motion.section>

                        {/* Goals */}
            {goalFlag && data.goals.length > 0 && (
              <motion.section
                aria-label="اهداف من"
                className="rounded-3xl border border-border bg-surface-1 p-6"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold flex items-center gap-2">
                    <Icon name="Target" size={17} className="text-primary" />
                    اهداف من
                  </h2>
                  <Link href="/analytics" className="text-xs text-esi-text-muted hover:text-esi-text-primary transition-colors">
                    همه اهداف ←
                  </Link>
                </div>
                <ul className="space-y-3">
                  {data.goals.map((g) => (
                    <li key={g.id}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold truncate">{g.title}</span>
                        <span className="tabular-nums text-esi-text-secondary">{toPersianDigits(g.percent)}٪</span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${g.percent}%` }}
                          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                          className="h-full rounded-full esi-gradient-brand"
                        />
                      </div>
                      <p className="text-[10px] text-esi-text-muted mt-1">{g.statusFa}</p>
                    </li>
                  ))}
                </ul>
              </motion.section>
            )}

{/* Weight history mini */}
            <motion.section
              aria-label="وزن"
              className="lg:col-span-3 rounded-3xl border border-border bg-surface-1 p-6"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold mb-1">وزن فعلی</h2>
                  {data.weight ? (
                    <p className="text-3xl font-extrabold tabular-nums">
                      {formatNumber(data.weight.current, { maximumFractionDigits: 1 })}
                      <span className="text-sm font-medium text-esi-text-muted ms-1">کیلوگرم</span>
                    </p>
                  ) : (
                    <p className="text-sm text-esi-text-muted">هنوز وزنی ثبت نشده</p>
                  )}
                </div>
                {data.weight && (
                  <p className={cn("text-sm tabular-nums font-medium", data.weight.deltaFromStart <= 0 ? "text-primary" : "text-amber-400")}>
                    {data.weight.deltaFromStart <= 0 ? "▼ " : "▲ "}
                    {formatDelta(data.weight.deltaFromStart)} از شروع
                  </p>
                )}
                <Button asChild variant="secondary" size="sm" className="h-9">
                  <Link href="/analytics">روند کامل</Link>
                </Button>
              </div>
            </motion.section>
          </div>
        </>
      )}
    </div>
  );
}

function WaterGlass({ pct }: { pct: number }) {
  return (
    <div className="relative h-16 w-12 rounded-b-2xl rounded-t-lg border-2 border-blue-500/40 overflow-hidden" aria-hidden>
      <motion.div
        className="absolute bottom-0 inset-x-0 bg-blue-500/35"
        initial={{ height: 0 }}
        animate={{ height: `${pct}%` }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Skeleton className="lg:col-span-2 h-48 rounded-3xl" />
      <Skeleton className="h-48 rounded-3xl" />
      <Skeleton className="lg:col-span-2 h-56 rounded-3xl" />
      <Skeleton className="h-56 rounded-3xl" />
      <Skeleton className="lg:col-span-3 h-28 rounded-3xl" />
    </div>
  );
}


const TONE_META: Record<string, { icon: string; cls: string; labelFa: string }> = {
  push: { icon: "Zap", cls: "border-primary/30 bg-primary/8 text-primary", labelFa: "روز فشار" },
  maintain: { icon: "Activity", cls: "border-border bg-surface-2 text-esi-text-secondary", labelFa: "حفظ روال" },
  adjust: { icon: "Shuffle", cls: "border-amber-500/30 bg-amber-500/8 text-amber-500", labelFa: "تغییر محرک" },
  recover: { icon: "BatteryLow", cls: "border-destructive/30 bg-destructive/8 text-destructive", labelFa: "ریکاوری" },
  return: { icon: "Undo2", cls: "border-blue-500/30 bg-blue-500/8 text-blue-500", labelFa: "بازگشت" },
};

function CoachGuidanceChip({
  tone,
  messageFa,
  cueFa,
  volumeModifierPercent,
}: {
  tone: string;
  messageFa: string;
  cueFa: string;
  volumeModifierPercent: number;
}) {
  const meta = TONE_META[tone] ?? TONE_META.maintain;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`mt-4 rounded-2xl border px-4 py-3 ${meta.cls}`}
      role="status"
    >
      <p className="text-xs font-bold flex items-center gap-2">
        <Icon name={meta.icon} size={14} />
        مربی تطبیقی — {meta.labelFa}
        {volumeModifierPercent !== 0 && (
          <span className="font-mono text-[10px] opacity-80">
            حجم {volumeModifierPercent > 0 ? "+" : ""}{toPersianDigits(volumeModifierPercent)}٪
          </span>
        )}
      </p>
      <p className="mt-1 text-xs leading-5 text-esi-text-secondary">{messageFa}</p>
      <p className="mt-1.5 text-[11px] leading-5 text-esi-text-secondary">
        <span className="font-semibold">امروز: </span>{cueFa}
      </p>
    </motion.div>
  );
}
