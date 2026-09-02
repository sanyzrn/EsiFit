"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/layout/app-shell";
import { RadialGauge } from "@/components/data-viz/radial-gauge";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/client/api";
import { toPersianDigits, formatNumber } from "@/lib/formatting/numbers";
import { formatRelative } from "@/lib/dates/jalali";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Overview = {
  xp: number;
  level: { level: number; currentLevelXp: number; nextLevelXp: number; progress: number };
  badges: Array<{
    id: string; slug: string; name: string; description: string; icon: string;
    tier: "bronze" | "silver" | "gold"; earnedAt: string | null; criteriaValue: number;
  }>;
  missions: Array<{
    id: string; name: string; description: string; period: "daily" | "weekly";
    target: number; progress: number; claimed: boolean; xpReward: number; criteriaType: string;
  }>;
};

const TIER_STYLE = {
  bronze: "text-amber-600 bg-amber-400/10 border-amber-400/30",
  silver: "text-slate-300 bg-slate-400/10 border-slate-400/30",
  gold: "text-amber-400 bg-amber-400/12 border-amber-400/40",
};

export function AchievementsView() {
  const [data, setData] = React.useState<Overview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [claiming, setClaiming] = React.useState<string | null>(null);
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    try {
      const res = await api<Overview>("/api/gamification/overview");
      setData(res);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const claim = async (missionId: string) => {
    setClaiming(missionId);
    try {
      const res = await api<{ xp: number }>("/api/gamification/claim", { method: "POST", json: { missionId } });
      toast({ title: `+${toPersianDigits(res.xp)} امتیاز تجربه`, description: "ماموریت با موفقیت جمع‌آوری شد." });
      await load();
    } catch (e) {
      toast({ title: "جمع‌آوری ناموفق", description: errorMessage(e), variant: "destructive" });
    } finally {
      setClaiming(null);
    }
  };

  const earned = data?.badges.filter((b) => b.earnedAt) ?? [];
  const locked = data?.badges.filter((b) => !b.earnedAt) ?? [];

  return (
    <div className="max-w-4xl mx-auto w-full pb-6">
      <PageHeader title="دستاوردها" description="امتیاز، نشان‌ها و ماموریت‌ها — همه به عملکرد واقعی گره خورده‌اند." />

      {error && (
        <div role="alert" className="mx-4 lg:mx-8 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!data ? (
        <div className="px-4 lg:px-8 space-y-4">
          <Skeleton className="h-48 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
        </div>
      ) : (
        <div className="px-4 lg:px-8 space-y-5">
          {/* Level gauge */}
          <section aria-label="سطح و امتیاز" className="rounded-3xl border border-border bg-surface-1 p-6 flex flex-col sm:flex-row items-center gap-8">
            <RadialGauge
              value={data.level.progress * 100}
              size={150}
              tone="violet"
              label={
                <div className="text-center">
                  <p className="text-3xl font-extrabold tabular-nums">{toPersianDigits(data.level.level)}</p>
                  <p className="text-[10px] text-esi-text-muted">سطح</p>
                </div>
              }
            />
            <div className="flex-1 text-center sm:text-start">
              <h2 className="text-xl font-bold">
                <AnimatedCounter value={data.xp} className="tabular-nums" /> امتیاز تجربه
              </h2>
              <p className="mt-1 text-sm text-esi-text-secondary">
                {formatNumber(data.level.nextLevelXp - data.xp)} امتیاز تا سطح {toPersianDigits(data.level.level + 1)}
              </p>
              <div className="mt-4 h-2.5 rounded-full bg-surface-3 overflow-hidden">
                <motion.div
                  className="h-full rounded-full esi-gradient-brand"
                  initial={{ width: 0 }}
                  animate={{ width: `${data.level.progress * 100}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <p className="mt-2 text-[11px] text-esi-text-muted">
                {toPersianDigits(earned.length)} نشان از {toPersianDigits(data.badges.length)} نشان ممکن
              </p>
            </div>
          </section>

          {/* Missions */}
          <section aria-label="ماموریت‌ها" className="rounded-3xl border border-border bg-surface-1 p-6">
            <h2 className="font-bold mb-4">ماموریت‌های امروز و این هفته</h2>
            <div className="space-y-3">
              {data.missions.map((m) => {
                const pct = Math.min(100, (m.progress / m.target) * 100);
                const done = m.progress >= m.target;
                return (
                  <div key={m.id} className="flex items-center gap-4 rounded-2xl bg-surface-2 px-4 py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate">{m.name}</p>
                        <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] text-esi-text-muted shrink-0">
                          {m.period === "daily" ? "روزانه" : "هفتگی"}
                        </span>
                      </div>
                      <p className="text-[11px] text-esi-text-muted mt-0.5">{m.description}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-surface-3 overflow-hidden max-w-40">
                          <motion.div
                            className={cn("h-full rounded-full", done ? "bg-primary" : "bg-blue-500")}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                        <span className="text-[11px] tabular-nums text-esi-text-muted">
                          {toPersianDigits(Math.min(m.progress, m.target))}/{toPersianDigits(m.target)}
                        </span>
                      </div>
                    </div>
                    {m.claimed ? (
                      <span className="text-xs text-esi-text-muted shrink-0 flex items-center gap-1">
                        <Icon name="Check" size={14} className="text-primary" />
                        جمع شد
                      </span>
                    ) : done ? (
                      <Button
                        size="sm"
                        className="h-9 shrink-0 esi-glow"
                        disabled={claiming === m.id}
                        onClick={() => void claim(m.id)}
                      >
                        +{toPersianDigits(m.xpReward)} XP
                      </Button>
                    ) : (
                      <span className="text-xs text-esi-text-muted shrink-0 tabular-nums">+{toPersianDigits(m.xpReward)} XP</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Badges */}
          <section aria-label="نشان‌ها" className="rounded-3xl border border-border bg-surface-1 p-6">
            <h2 className="font-bold mb-4">مجموعه نشان‌ها</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {[...earned, ...locked].map((b, i) => (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  title={b.description}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border p-3.5 text-center transition-transform hover:scale-105",
                    b.earnedAt ? TIER_STYLE[b.tier] : "border-border bg-surface-2 opacity-45 grayscale",
                  )}
                >
                  <Icon name={b.icon} size={26} strokeWidth={1.5} className={b.earnedAt ? "" : "text-esi-text-muted"} />
                  <p className="text-[11px] font-semibold leading-4">{b.name}</p>
                  {b.earnedAt ? (
                    <p className="text-[9px] text-esi-text-muted">{formatRelative(b.earnedAt)}</p>
                  ) : (
                    <p className="text-[9px] text-esi-text-muted">قفل</p>
                  )}
                </motion.div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
