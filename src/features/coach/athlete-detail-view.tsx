"use client";

import * as React from "react";
import { ProgramEditor } from "./program-editor";
import { CoachNote } from "./coach-note";
import type { CoachExerciseOption } from "@/lib/coach/program-contract";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/layout/page-header";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import type { AthleteDetail } from "@/lib/coach/data";
import { toPersianDigits, formatNumber, formatDelta } from "@/lib/formatting/numbers";
import { formatRelative, formatJalaliLong } from "@/lib/dates/jalali";
import { formatWorkoutPlanTitle } from "@/lib/workout/plan-titles";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

const PAIN_REGION_FA: Record<string, string> = {
  lower_back: "کمر پایین", shoulder: "سرشانه", knee: "زانو", elbow: "آرنج",
  wrist: "مچ", hip: "لگن", ankle: "قوزک پا", neck: "گردن", groin: "کشاله ران",
  ribs: "دنده", other: "سایر",
};

export function AthleteDetailView({ detail, backHref, catalog = [], coachNote = "", canManage = false }: { detail: AthleteDetail; backHref: string; catalog?: CoachExerciseOption[]; coachNote?: string; canManage?: boolean }) {
  const weightData = detail.weightTrend.map((m) => ({ date: m.date, weight: m.weightKg }));
  const tonnageData = detail.weeklyTonnage.slice(-8).map((w) => ({
    label: formatJalaliLong(w.weekStart).split(" ").slice(1).join(" "),
    tonnage: Math.round(w.tonnageKg / 100) / 10,
  }));

  return (
    <div className="max-w-6xl mx-auto w-full pb-6">
      <PageHeader
        title={detail.athlete.displayName}
        description={detail.planName ? formatWorkoutPlanTitle(detail.planName) : "بدون برنامه فعال"}
        backHref={backHref}
        action={
          <Badge variant="tier" className="h-7 px-3">
            {detail.athlete.tier === "free" ? "رایگان" : detail.athlete.tier === "vip" ? "وی‌آی‌پی" : detail.athlete.tier === "vip_plus" ? "وی‌آی‌پی پلاس" : "مربی"}
          </Badge>
        }
      />

      <div className="px-4 lg:px-8 space-y-5">
        {/* Stat row */}
        <section aria-label="آمار کلیدی" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "استریک فعلی", value: detail.streakDays, suffix: " روز", icon: "Flame" },
            { label: "رکوردهای فعال", value: detail.currentPrs.length, icon: "Trophy" },
            { label: "اهداف فعال", value: detail.goals.length, icon: "Target" },
            { label: "جلسات اخیر", value: detail.recentSessions.length, icon: "Dumbbell" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="esi-card rounded-3xl p-4 text-center"
            >
              <Icon name={s.icon} size={18} className="text-primary mx-auto" />
              <p className="mt-1.5 text-xl font-extrabold tabular-nums">
                <AnimatedCounter value={s.value} />{s.suffix ?? ""}
              </p>
              <p className="text-[10px] text-esi-text-muted mt-0.5">{s.label}</p>
            </motion.div>
          ))}
        </section>

        {/* Pain alerts */}
        {detail.activePain.length > 0 && (
          <section aria-label="گزارش‌های درد" className="rounded-3xl border border-amber-500/25 bg-amber-500/8 p-5">
            <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
              <Icon name="HeartPulse" size={16} className="text-amber-500" />
              درد فعال — قبل از تجویز حرکت بخوان
            </h2>
            <ul className="space-y-2">
              {detail.activePain.map((p, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <Badge variant="neutral">{PAIN_REGION_FA[p.bodyRegion] ?? p.bodyRegion}</Badge>
                  <span className="text-esi-text-secondary">{p.note || `شدت ${toPersianDigits(p.severity)} از ۱۰`}</span>
                  <span className="text-[11px] text-esi-text-muted ms-auto">{formatRelative(p.reportedOn)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Weight trend */}
          <section aria-label="روند وزن" className="esi-card rounded-3xl p-6">
            <h2 className="font-bold mb-1">روند وزن</h2>
            <p className="text-xs text-esi-text-secondary mb-4">
              {weightData.length >= 2
                ? `${formatDelta(weightData[weightData.length - 1].weight! - weightData[0].weight!)} کیلوگرم از ابتدای ثبت`
                : "داده کافی موجود نیست"}
            </p>
            {weightData.length >= 2 ? (
              <div dir="ltr">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={weightData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                    <defs>
                      <linearGradient id="coachWeightFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickFormatter={(d: string) => toPersianDigits(formatJalaliLong(d).split(" ").slice(0, 2).join(" "))} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
                    <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} domain={["dataMin - 1", "dataMax + 1"]} tickLine={false} axisLine={false} tickFormatter={(v: number) => toPersianDigits(v)} />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontFamily: "inherit", direction: "rtl" }} labelFormatter={(d: string) => formatJalaliLong(d)} formatter={(v: number) => [`${v} کیلوگرم`, "وزن"]} />
                    <Line type="monotone" dataKey="weight" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} fill="url(#coachWeightFill)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-esi-text-muted">حداقل دو اندازه‌گیری لازم است</p>
            )}
          </section>

          {/* Weekly tonnage */}
          <section aria-label="حجم هفتگی" className="esi-card rounded-3xl p-6">
            <h2 className="font-bold mb-4">حجم هفتگی (تُن)</h2>
            {tonnageData.some((t) => t.tonnage > 0) ? (
              <div dir="ltr">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={tonnageData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 9 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={0} angle={-35} height={44} textAnchor="end" />
                    <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => toPersianDigits(v)} />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, direction: "rtl", fontFamily: "inherit" }} formatter={(v: number) => [`${toPersianDigits(v)} تُن`, "حجم"]} />
                    <Bar dataKey="tonnage" fill="var(--chart-1)" radius={[6, 6, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-esi-text-muted">با ثبت تمرین، نمودار ساخته می‌شود</p>
            )}
          </section>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* PRs */}
          <section aria-label="رکوردهای فعلی" className="esi-card rounded-3xl p-6">
            <h2 className="font-bold mb-4">رکوردهای شخصی فعال</h2>
            {detail.currentPrs.length === 0 ? (
              <p className="py-6 text-center text-sm text-esi-text-muted">هنوز رکوردی ثبت نشده</p>
            ) : (
              <ul className="space-y-2">
                {detail.currentPrs.map((pr) => (
                  <li key={pr.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-2.5">
                    <Icon name="Trophy" size={15} className="text-amber-400 shrink-0" />
                    <span className="text-sm truncate flex-1">{pr.exerciseName}</span>
                    <span className="text-sm font-bold tabular-nums">{formatNumber(pr.value, { maximumFractionDigits: 1 })} <span className="text-[10px] font-normal text-esi-text-muted">kg</span></span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Goals */}
          <section aria-label="اهداف" className="esi-card rounded-3xl p-6">
            <h2 className="font-bold mb-4">اهداف فعال</h2>
            {detail.goals.length === 0 ? (
              <p className="py-6 text-center text-sm text-esi-text-muted">هدفی تعیین نشده است</p>
            ) : (
              <ul className="space-y-3">
                {detail.goals.map((g) => (
                  <li key={g.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold truncate">{g.title}</span>
                      <span className="tabular-nums text-esi-text-secondary">{toPersianDigits(g.percent)}٪</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${g.percent}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        className="h-full rounded-full esi-gradient-brand"
                      />
                    </div>
                    <p className="text-[10px] text-esi-text-muted mt-1">{g.statusFa}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section aria-label="مشخصات و پیگیری" className="esi-card rounded-3xl p-5">
          <h2 className="font-bold">مشخصات و تغذیهٔ ثبت‌شده</h2>
          <p className="mt-3 text-sm text-esi-text-secondary">هدف هفتگی: {toPersianDigits(detail.profile?.weeklyWorkoutTarget ?? 3)} جلسه · سطح: {detail.profile?.experienceLevel === "advanced" ? "باتجربه" : detail.profile?.experienceLevel === "intermediate" ? "متوسط" : detail.profile?.experienceLevel === "beginner" ? "مبتدی" : "ثبت نشده"}</p>
          <p className="mt-2 text-xs text-esi-text-secondary">هدف روزانه: {detail.profile?.dailyCalorieTarget ? `${formatNumber(detail.profile.dailyCalorieTarget)} کالری` : "کالری تعیین نشده"} · {detail.profile?.dailyProteinTarget ? `${formatNumber(detail.profile.dailyProteinTarget)} گرم پروتئین` : "پروتئین تعیین نشده"}</p>
          <div className="mt-4 overflow-x-auto"><table className="w-full text-start text-xs"><caption className="mb-3 text-start text-esi-text-secondary">۷ روز اخیر؛ روزهای بدون ثبت، صفر مصرف محسوب نمی‌شوند.</caption><thead><tr className="border-b border-border"><th className="py-2 text-start">تاریخ</th><th className="text-start">ثبت غذا</th><th className="text-start">کالری</th><th className="text-start">پروتئین</th></tr></thead><tbody>{detail.nutrition7d.map(d=><tr key={d.date} className="border-b border-border"><td className="py-3">{formatJalaliLong(d.date)}</td><td>{toPersianDigits(d.entries)}</td><td>{formatNumber(d.calories)}</td><td>{formatNumber(d.proteinG)} گرم</td></tr>)}</tbody></table></div>
          {!detail.nutrition7d.length && <p className="py-4 text-sm text-esi-text-muted">در این هفت روز غذایی ثبت نشده است.</p>}
          {detail.readiness14.length > 0 && <p className="mt-4 text-sm text-esi-text-secondary">آخرین آمادگی ثبت‌شده: {toPersianDigits(detail.readiness14.at(-1)!.score)} از ۱۰۰ · {formatJalaliLong(detail.readiness14.at(-1)!.scoreDate)}</p>}
        </section>
        {detail.activePlan && <section className="esi-card rounded-3xl p-5" aria-label="برنامه فعلی"><h2 className="font-bold">برنامه فعلی</h2><p className="mt-2 text-sm">{detail.activePlan.name} · {toPersianDigits(detail.activePlan.weeks)} هفته</p><p className="mt-2 whitespace-pre-line text-xs leading-6 text-esi-text-secondary">{detail.activePlan.description}</p><div className="mt-4 space-y-2">{detail.activePlan.days.map((d,i)=><details key={i} className="rounded-xl bg-surface-2 p-3"><summary className="min-h-11 cursor-pointer text-sm font-semibold">{d.name} {d.isRest ? "· استراحت" : ""}</summary><ul className="space-y-2 text-xs">{d.exercises.map((e,j)=><li key={j} className="flex justify-between gap-3"><span>{catalog.find(x=>x.slug===e.slug)?.nameFa ?? e.slug}</span><span>{toPersianDigits(e.sets)} ست · {toPersianDigits(e.repsMin)}–{toPersianDigits(e.repsMax)} تکرار</span></li>)}</ul></details>)}</div></section>}
        {canManage && <><CoachNote key={detail.athlete.id} athleteId={detail.athlete.id} initialNote={coachNote}/><ProgramEditor key={detail.athlete.id} athleteId={detail.athlete.id} activePlan={detail.activePlan} catalog={catalog} equipment={detail.profile?.availableEquipment ?? ""}/></>}

        {/* Recent sessions */}
        <section aria-label="جلسات اخیر" className="esi-card rounded-3xl p-6">
          <h2 className="font-bold mb-4">جلسات اخیر</h2>
          <ul className="space-y-2">
            {detail.recentSessions.slice(0, 6).map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{s.name}</p>
                  <p className="text-[11px] text-esi-text-muted mt-0.5">
                    {formatJalaliLong(s.date)} • {toPersianDigits(s.durationMinutes)} دقیقه
                  </p>
                </div>
                <span className="text-xs font-bold tabular-nums text-esi-text-secondary">
                  {formatNumber(Math.round(s.volumeKg), { notation: "compact" })} کیلوگرم
                </span>
              </li>
            ))}
            {detail.recentSessions.length === 0 && (
              <li className="py-6 text-center text-sm text-esi-text-muted">جلسه‌ای ثبت نشده</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
