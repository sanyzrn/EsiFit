"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/layout/app-shell";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api, errorMessage } from "@/lib/client/api";
import type { AthleteDetail } from "@/lib/coach/data";
import { toPersianDigits, formatNumber, formatDelta } from "@/lib/formatting/numbers";
import { formatRelative, formatJalaliLong } from "@/lib/dates/jalali";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

const PAIN_REGION_FA: Record<string, string> = {
  lower_back: "کمر پایین", shoulder: "سرشانه", knee: "زانو", elbow: "آرنج",
  wrist: "مچ", hip: "لگن", ankle: "قوزک پا", neck: "گردن", groin: "کشاله ران",
  ribs: "دنده", other: "سایر",
};

const TEMPLATES = [
  { key: "ppl", label: "پوش/پول/پا — ۳ روز" },
  { key: "upper_lower", label: "بالاتنه/پایین‌تنه — ۴ روز" },
] as const;

export function AthleteDetailView({ detail, backHref }: { detail: AthleteDetail; backHref: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [template, setTemplate] = React.useState<string>("upper_lower");
  const [note, setNote] = React.useState("");
  const [assigning, setAssigning] = React.useState(false);

  const weightData = detail.weightTrend.map((m) => ({ date: m.date, weight: m.weightKg }));
  const tonnageData = detail.weeklyTonnage.slice(-8).map((w) => ({
    label: formatJalaliLong(w.weekStart).split(" ").slice(1).join(" "),
    tonnage: Math.round(w.tonnageKg / 100) / 10,
  }));

  const assign = async () => {
    setAssigning(true);
    try {
      const res = await api<{ planName: string }>("/api/coach/assign", {
        method: "POST",
        body: JSON.stringify({ athleteId: detail.athlete.id, template, note: note || undefined }),
      });
      toast({ title: "برنامه فعال شد", description: `«${res.planName}» برای ${detail.athlete.displayName} فعال شد.` });
      setNote("");
      router.refresh();
    } catch (e) {
      toast({ title: "خطا", description: errorMessage(e), variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full pb-6">
      <PageHeader
        title={detail.athlete.displayName}
        description={detail.planName ?? "بدون برنامه فعال"}
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
              className="rounded-3xl border border-border bg-surface-1 p-4 text-center"
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
          <section aria-label="روند وزن" className="rounded-3xl border border-border bg-surface-1 p-6">
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
          <section aria-label="حجم هفتگی" className="rounded-3xl border border-border bg-surface-1 p-6">
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
          <section aria-label="رکوردهای فعلی" className="rounded-3xl border border-border bg-surface-1 p-6">
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
          <section aria-label="اهداف" className="rounded-3xl border border-border bg-surface-1 p-6">
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

        {/* Assign program */}
        <section aria-label="تجویز برنامه" className="rounded-3xl border border-border bg-surface-1 p-6">
          <h2 className="font-bold flex items-center gap-2 mb-1">
            <Icon name="ClipboardList" size={18} className="text-primary" />
            تجویز برنامه جدید
          </h2>
          <p className="text-xs text-esi-text-secondary mb-4">
            برنامه فعال قبلی آرشیو و برنامه جدید از فردا در داشبورد ورزشکار قرار می‌گیرد.
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
            <div>
              <label htmlFor="tpl" className="text-xs font-medium text-esi-text-secondary mb-1.5 block">الگوی برنامه</label>
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger id="tpl" className="w-full h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="note" className="text-xs font-medium text-esi-text-secondary mb-1.5 block">یادداشت مربی (اختیاری)</label>
              <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً: دو هفته اول با RPE ۷ اجرا شود" className="min-h-[44px]" maxLength={280} />
            </div>
            <Button onClick={() => void assign()} disabled={assigning} className="h-11 esi-glow">
              {assigning ? "…" : "فعال‌سازی"}
            </Button>
          </div>
        </section>

        {/* Recent sessions */}
        <section aria-label="جلسات اخیر" className="rounded-3xl border border-border bg-surface-1 p-6">
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
