"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReadinessFactor } from "@/components/data-viz/recovery-orb";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/ui/icon";
import { api, errorMessage, isApiError } from "@/lib/client/api";
import { cacheGet, cachePut, enqueueOperation, newClientId } from "@/lib/offline/adapter";
import { useSession } from "@/lib/client/use-session";
import { useFeatureFlag } from "@/lib/feature-flags/flag-provider";
import { formatJalaliWeekdayDay } from "@/lib/dates/jalali";
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

const READINESS_LABELS: Record<string, string> = {
  ready: "آماده تمرین",
  moderate: "آمادگی متوسط",
  caution: "کمی محتاط",
  recover: "نیاز به ریکاوری",
};
const GUIDANCE_LABELS: Record<string, string> = {
  push: "فشار بیشتر",
  maintain: "حفظ روند",
  adjust: "تعدیل تمرین",
  recover: "ریکاوری",
  return: "بازگشت به تمرین",
};

const sectionClass = "rounded-2xl border border-border bg-surface-1 p-4 sm:p-6";

/** Clear content hierarchy: Greeting → Today → Progress → Actions → History.
 * The old decorative glow/orb/water wave has been replaced by readable numbers.
 * API contract and offline write semantics are intentionally unchanged.
 */
export function DashboardView() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [waterBusy, setWaterBusy] = React.useState(false);
  const [workoutBusy, setWorkoutBusy] = React.useState(false);
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
      setError(null);
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

  React.useEffect(() => { void load(); }, [load]);

  const addWater = async (ml: number) => {
    if (waterBusy) return;
    setWaterBusy(true);
    const clientId = newClientId("water");
    const loggedAt = new Date().toISOString();
    const op = { clientId, kind: "water" as const, endpoint: "/api/water", payload: { ml, clientId, loggedAt } };
    try {
      await api("/api/water", { method: "POST", json: { ml, clientId, loggedAt } });
      setData((d) => d ? { ...d, water: { ...d.water, ml: d.water.ml + ml } } : d);
      setError(null);
    } catch (e) {
      if (offlineFlag && isApiError(e) && e.code === "network") {
        await enqueueOperation(op);
        setData((d) => d ? { ...d, water: { ...d.water, ml: d.water.ml + ml } } : d);
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setWaterBusy(false);
    }
  };

  const startWorkout = async () => {
    if (workoutBusy) return;
    setWorkoutBusy(true);
    try {
      const payload = data?.todayWorkout?.planDayId ? { planDayId: data.todayWorkout.planDayId } : {};
      const res = await api<{ session: { id: string } }>("/api/workouts/sessions", { method: "POST", json: payload });
      router.push(`/workout/live?session=${res.session.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setWorkoutBusy(false);
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 5 ? "شب‌بخیر" : hour < 12 ? "صبح بخیر" : hour < 17 ? "وقت بخیر" : "عصر بخیر";
  const waterPct = data?.water.targetMl ? Math.min(100, Math.round(data.water.ml / data.water.targetMl * 100)) : 0;
  const nutritionPct = data?.nutrition.targets?.calories
    ? Math.min(100, Math.round(data.nutrition.totals.calories / data.nutrition.targets.calories * 100)) : 0;
  const readinessScore = data?.readiness ? Math.max(0, Math.min(100, data.readiness.score)) : 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-8 pt-6 sm:space-y-8 lg:px-8 lg:pt-10">
      {/* Greeting — editorial type and a compact, non-decorative status line. */}
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between sm:pb-6">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-medium text-esi-text-secondary">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            {formatJalaliWeekdayDay(new Date())}
          </p>
          <h1 className="mt-2 text-2xl font-extrabold leading-snug tracking-tight sm:text-3xl lg:text-4xl">
            {greeting}، <span className="text-primary">{data?.greetingName ?? session?.displayName ?? "ورزشکار"}</span>
          </h1>
          <p className="mt-1 text-sm leading-7 text-esi-text-secondary">برنامه امروزت، بدون شلوغی.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-surface-1 px-3 text-xs font-medium text-esi-text-secondary">
            <Icon name="Flame" size={17} className="text-primary" />
            <strong className="tabular-nums text-esi-text-primary">{toPersianDigits(data?.gamification.streakDays ?? 0)}</strong> روز استمرار
          </span>
          <span className="inline-flex min-h-10 items-center rounded-xl border border-border bg-surface-1 px-3 text-xs font-semibold text-esi-text-primary">
            {TIER_LABELS[(session?.tier ?? "free") as UserTier] ?? "رایگان"}
          </span>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => void load()}>تلاش دوباره</Button>
        </div>
      )}

      {!data ? <DashboardSkeleton /> : (
        <>
          {/* Today: only one prominent action, with rest/resume states intact. */}
          <section aria-label="تمرین امروز" className="overflow-hidden rounded-2xl border border-border bg-surface-2">
            <div className="h-1 w-20 bg-primary" aria-hidden />
            <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0">
                <div className="mb-4 flex items-center gap-2">
                  <Icon name="CalendarCheck" size={17} className="text-primary" />
                  <span className="text-xs font-bold tracking-wide text-primary">امروز / برنامه تمرین</span>
                </div>
                <h2 className="max-w-xl text-2xl font-extrabold leading-snug sm:text-3xl lg:text-4xl">
                  {data.activeSession
                    ? "تمرینت منتظر ادامه است"
                    : data.todayWorkout?.isRest
                      ? "امروز برای ریکاوریه"
                      : data.todayWorkout?.name ?? "برای حرکت آماده‌ای؟"}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-esi-text-secondary">
                  {data.activeSession
                    ? `جلسه «${data.activeSession.name}» ذخیره شده؛ از همان‌جا ادامه بده.`
                    : data.todayWorkout?.isRest
                      ? "استراحت و حرکت سبک بخشی از پیشرفتت هستند."
                      : data.todayWorkout
                        ? `${toPersianDigits(data.todayWorkout.exerciseCount)} حرکت · حدود ${toPersianDigits(data.todayWorkout.estimatedMinutes)} دقیقه`
                        : "یک جلسه آزاد انتخاب کن و مسیرت رو شروع کن."}
                </p>
                {coachFlag && data.coachGuidance && (
                  <div className="mt-4 max-w-xl border-t border-border pt-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-esi-text-primary">
                      <Icon name="Activity" size={15} className="text-primary" />
                      {GUIDANCE_LABELS[data.coachGuidance.tone] ?? "راهنمای تمرین"}
                      {data.coachGuidance.volumeModifierPercent !== 0 && (
                        <span className="font-normal text-esi-text-muted">
                          · حجم {toPersianDigits(data.coachGuidance.volumeModifierPercent)}٪
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-6 text-esi-text-secondary">{data.coachGuidance.messageFa}</p>
                    <p className="mt-1 text-xs leading-6 text-esi-text-muted">{data.coachGuidance.cueFa}</p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 lg:min-w-44 lg:flex-col">
                {data.activeSession ? (
                  <Button asChild size="lg" className="min-w-36">
                    <Link href={`/workout/live?session=${data.activeSession.id}`}>
                      ادامه تمرین <Icon name="ChevronLeft" size={18} />
                    </Link>
                  </Button>
                ) : data.todayWorkout?.isRest ? (
                  <Button asChild size="lg" variant="secondary"><Link href="/workouts">انتخاب تمرین</Link></Button>
                ) : (
                  <Button onClick={() => void startWorkout()} disabled={workoutBusy} size="lg">
                    {workoutBusy ? "در حال شروع…" : "شروع تمرین"} <Icon name="ChevronLeft" size={18} />
                  </Button>
                )}
                <Button asChild variant="outline"><Link href="/workouts">برنامه‌های من</Link></Button>
              </div>
            </div>
          </section>

          {/* Progress: useful at a glance, visually separate from actions. */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-primary">نگاه سریع</p>
              <h2 className="mt-1 text-lg font-extrabold sm:text-xl">وضعیت امروز</h2>
            </div>
            <Link href="/analytics" className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-xs font-semibold text-esi-text-secondary transition-colors hover:bg-surface-2 hover:text-esi-text-primary">
              جزئیات <Icon name="ChevronLeft" size={15} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {readinessFlag && (
              <section aria-label="آمادگی امروز" className={cn(sectionClass, "min-w-0")}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">آمادگی امروز</h2>
                  <Icon name="HeartPulse" size={18} className="text-primary" />
                </div>
                {data.readiness ? (
                  <>
                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="text-3xl font-bold tabular-nums sm:text-4xl">{toPersianDigits(readinessScore)}</span>
                      <span className="text-xs text-esi-text-muted">از ۱۰۰</span>
                    </div>
                    <Progress value={readinessScore} aria-label="امتیاز آمادگی امروز" className="mt-3 h-2" />
                    <p className="mt-3 text-xs leading-6 text-esi-text-secondary">{READINESS_LABELS[data.readiness.state] ?? "آمادگی روزانه"}{data.readiness.isEstimated ? " · تخمینی" : ""}</p>
                    {data.readiness.factors.length > 0 && (
                      <details className="mt-3 text-xs">
                        <summary className="cursor-pointer font-medium text-primary">عوامل مؤثر بر آمادگی</summary>
                        <ul className="mt-3 space-y-2">
                          {data.readiness.factors.map((factor) => (
                            <li key={factor.type} className="flex items-center justify-between gap-2 text-esi-text-secondary">
                              <span>{factor.label}</span><span className="tabular-nums">{toPersianDigits(factor.normalizedScore)}٪</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </>
                ) : <p className="mt-5 text-sm leading-7 text-esi-text-muted">هنوز داده کافی ثبت نشده.</p>}
              </section>
            )}

            <section aria-label="روند تمرین" className={cn(sectionClass, "min-w-0")}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">روند فعالیت</h2>
                <Icon name="ChartLine" size={18} className="text-primary" />
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums sm:text-4xl">{toPersianDigits(data.gamification.level)}</span>
                <span className="text-xs text-esi-text-muted">سطح فعلی</span>
              </div>
              <Progress value={data.gamification.levelProgress} aria-label="پیشرفت سطح فعلی" className="mt-3 h-2" />
              <p className="mt-3 text-xs text-esi-text-secondary">
                {toPersianDigits(data.gamification.xp)} امتیاز · {toPersianDigits(data.gamification.streakDays)} روز استمرار
              </p>
              <Link href="/achievements" className="mt-4 inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-primary">
                دستاوردهای من <Icon name="ChevronLeft" size={14} />
              </Link>
            </section>

            <section aria-label="کالری امروز" className={cn(sectionClass, readinessFlag ? "col-span-2 lg:col-span-1" : "min-w-0")}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">کالری امروز</h2>
                <Icon name="Apple" size={18} className="text-primary" />
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums sm:text-4xl">{formatNumber(data.nutrition.totals.calories)}</span>
                <span className="text-xs text-esi-text-muted">کیلوکالری</span>
              </div>
              <Progress value={nutritionPct} aria-label="درصد کالری امروز" className="mt-3 h-2" />
              <p className="mt-3 text-xs text-esi-text-secondary">
                {data.nutrition.targets
                  ? `از هدف ${formatNumber(data.nutrition.targets.calories)} کیلوکالری`
                  : "برای نمایش هدف، پروفایلت رو تکمیل کن."}
              </p>
              <Link href="/nutrition" className="mt-4 inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-primary">
                دفتر تغذیه <Icon name="ChevronLeft" size={14} />
              </Link>
            </section>
          </div>

          {/* Daily actions: macros and drinking remain fully functional. */}
          <div>
            <p className="text-xs font-semibold text-primary">ثبت روزانه</p>
            <h2 className="mt-1 text-lg font-extrabold sm:text-xl">تغذیه و آب</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <section aria-label="تغذیه و درشت‌مغذی‌ها" className={sectionClass}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold">تغذیه</h2>
                  <p className="mt-1 text-xs text-esi-text-muted">{toPersianDigits(data.nutrition.entryCount)} وعده ثبت‌شده</p>
                </div>
                <Button asChild variant="outline" size="sm"><Link href="/nutrition">ثبت وعده</Link></Button>
              </div>
              <div className="space-y-4">
                {([
                  { label: "پروتئین", key: "proteinG" as const, color: "bg-turquoise" },
                  { label: "کربوهیدرات", key: "carbsG" as const, color: "bg-lapis" },
                  { label: "چربی", key: "fatG" as const, color: "bg-iris" },
                ]).map((macro) => {
                  const actual = data.nutrition.totals[macro.key];
                  const target = data.nutrition.targets?.[macro.key];
                  const percent = target ? Math.min(100, actual / target * 100) : 0;
                  return (
                    <div key={macro.key}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium text-esi-text-secondary">{macro.label}</span>
                        <span className="tabular-nums text-esi-text-muted">
                          {formatNumber(actual)} {target ? `/ ${formatNumber(target)}` : ""} گرم
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label={macro.label} aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
                        <div className={cn("h-full rounded-full", macro.color)} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {!data.nutrition.entryCount && (
                <p className="mt-4 rounded-xl border border-border bg-surface-2 p-3 text-xs leading-6 text-esi-text-secondary">
                  اولین وعده رو ثبت کن تا روند تغذیه اینجا نمایش داده بشه.
                </p>
              )}
            </section>

            <section aria-label="آب روزانه" className={sectionClass}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold">آب روزانه</h2>
                  <p className="mt-1 text-xs text-esi-text-muted">ساده و سریع ثبت کن</p>
                </div>
                <Icon name="Droplets" size={19} className="text-lapis" />
              </div>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums sm:text-4xl">{formatNumber(data.water.ml / 1000, { maximumFractionDigits: 2 })}</span>
                <span className="text-xs text-esi-text-muted">لیتر از {formatNumber(data.water.targetMl / 1000, { maximumFractionDigits: 1 })} لیتر</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={waterPct} aria-valuemin={0} aria-valuemax={100} aria-label="درصد آب مصرفی">
                <div className="h-full rounded-full bg-lapis" style={{ width: `${waterPct}%` }} />
              </div>
              <p className="mt-2 text-xs text-esi-text-secondary">{toPersianDigits(waterPct)}٪ هدف روزانه</p>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[250, 500, 750].map((ml) => (
                  <button
                    key={ml} type="button" disabled={waterBusy}
                    onClick={() => void addWater(ml)}
                    className="flex min-h-12 items-center justify-center rounded-xl border border-border bg-surface-2 px-1 text-xs font-semibold tabular-nums transition-colors hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 sm:text-sm"
                  >+{toPersianDigits(ml)} <span className="ms-1 text-[11px] font-normal">میلی‌لیتر</span></button>
                ))}
              </div>
            </section>
          </div>

          {/* Historical trends come last, after today's priorities. */}
          <div>
            <p className="text-xs font-semibold text-primary">مسیر تو</p>
            <h2 className="mt-1 text-lg font-extrabold sm:text-xl">تغییرات و هدف‌ها</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {goalFlag && data.goals.length > 0 && (
              <section aria-label="اهداف من" className={sectionClass}>
                <div className="mb-5 flex items-center justify-between gap-2">
                  <h2 className="text-base font-bold">اهداف من</h2>
                  <Button asChild variant="ghost" size="sm"><Link href="/analytics">جزئیات</Link></Button>
                </div>
                <ul className="space-y-4">
                  {data.goals.map((goal) => (
                    <li key={goal.id}>
                      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-medium">{goal.title}</span>
                        <span className="shrink-0 tabular-nums text-esi-text-muted">{toPersianDigits(goal.percent)}٪</span>
                      </div>
                      <Progress value={Math.max(0, Math.min(goal.percent, 100))} aria-label={`پیشرفت ${goal.title}`} />
                      <p className="mt-1.5 text-xs text-esi-text-muted">{goal.statusFa}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section aria-label="تغییرات وزن" className={cn(sectionClass, goalFlag && data.goals.length > 0 ? "" : "lg:col-span-2")}>
              <div className="mb-5 flex items-center justify-between gap-2">
                <h2 className="text-base font-bold">روند وزن</h2>
                <Button asChild variant="ghost" size="sm"><Link href="/analytics">مشاهده روند</Link></Button>
              </div>
              {data.weight ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold tabular-nums sm:text-4xl">{formatNumber(data.weight.current, { maximumFractionDigits: 1 })}</span>
                    <span className="text-xs text-esi-text-muted">کیلوگرم</span>
                  </div>
                  <p className={cn("mt-3 text-xs font-medium", data.weight.deltaFromStart <= 0 ? "text-turquoise" : "text-esi-text-secondary")}>
                    {formatDelta(data.weight.deltaFromStart)} کیلو از زمان شروع
                  </p>
                </>
              ) : (
                <p className="text-sm leading-7 text-esi-text-muted">هنوز وزنی ثبت نشده؛ از بخش پیشرفت اندازه‌گیریت رو وارد کن.</p>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="در حال بارگذاری داشبورد">
      <Skeleton className="h-52 rounded-2xl border border-border" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-52 rounded-2xl border border-border" />
        <Skeleton className="h-52 rounded-2xl border border-border" />
      </div>
    </div>
  );
}
