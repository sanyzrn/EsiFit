"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/hooks/use-toast";
import { api, errorMessage } from "@/lib/client/api";
import { toPersianDigits } from "@/lib/formatting/numbers";
import { formatJalaliLong } from "@/lib/dates/jalali";
import { cn } from "@/lib/utils";

export type RecapPayload = {
  weekStart: string;
  contentFa: string;
  source: "rules" | "ai";
  metrics: {
    sessions: number;
    plannedSessions: number;
    tonnageKg: number;
    prs: Array<{ exerciseName: string }>;
    avgReadiness: number | null;
    nutritionDaysLogged: number;
    streakDays: number;
  };
};

/**
 * WeeklyRecapCard — جمع‌بندی هوشمند هفته (WEEKLY_RECAP, entitlement weeklyRecap).
 * Rules-based narrative always; AI rewrite is an explicit user action (no
 * surprise inference), persisted server-side.
 */
export function WeeklyRecapCard({
  locked,
  onLockedCta,
}: {
  locked: boolean;
  onLockedCta: () => void;
}) {
  const reduce = useReducedMotion();
  const { toast } = useToast();
  const [recap, setRecap] = React.useState<RecapPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [enhancing, setEnhancing] = React.useState(false);

  React.useEffect(() => {
    if (locked) {
      setLoading(false);
      return;
    }
    api<{ recap: RecapPayload }>("/api/ai/weekly-recap")
      .then((d) => setRecap(d.recap))
      .catch(() => setRecap(null))
      .finally(() => setLoading(false));
  }, [locked]);

  const enhance = async () => {
    setEnhancing(true);
    try {
      const d = await api<{ recap: RecapPayload }>("/api/ai/weekly-recap", { method: "POST" });
      setRecap(d.recap);
      toast({ title: "بازنویسی هوشمند انجام شد", description: "همان داده‌ها با روایت تازه." });
    } catch (e) {
      toast({ title: "خطا", description: errorMessage(e), variant: "destructive" });
    } finally {
      setEnhancing(false);
    }
  };

  if (loading) {
    return <div className="rounded-3xl border border-border bg-surface-1 p-6 h-40 animate-pulse" aria-hidden />;
  }

  if (locked) {
    return (
      <section aria-label="جمع‌بندی هفتگی" className="rounded-3xl border border-border bg-surface-1 p-6">
        <h2 className="font-bold flex items-center gap-2 mb-2">
          <Icon name="ScrollText" size={18} className="text-esi-text-secondary" />
          جمع‌بندی هوشمند هفته
        </h2>
        <p className="text-sm text-esi-text-secondary leading-6">
          هر هفته، روند تمرین و ریکاوری‌ات در یک متن کوتاه و قابل‌اجرا خلاصه می‌شود. تحلیل‌های اصلی برای همه اعضا آزاد است؛ جمع‌بندی روایی در پلن وی‌آی‌پی فعال می‌شود.
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onLockedCta}>
          دیدن پلن‌ها
        </Button>
      </section>
    );
  }

  if (!recap) {
    return (
      <section aria-label="جمع‌بندی هفتگی" className="rounded-3xl border border-border bg-surface-1 p-6">
        <h2 className="font-bold flex items-center gap-2 mb-2">
          <Icon name="ScrollText" size={18} className="text-primary" />
          جمع‌بندی هوشمند هفته
        </h2>
        <p className="text-sm text-esi-text-muted">دریافت جمع‌بندی ممکن نشد — کمی بعد دوباره تلاش کنید.</p>
      </section>
    );
  }

  const m = recap.metrics;
  const chips = [
    { icon: "Dumbbell", text: `${toPersianDigits(m.sessions)} از ${toPersianDigits(m.plannedSessions)} جلسه` },
    ...(m.tonnageKg > 0 ? [{ icon: "Mountain", text: `${toPersianDigits(Math.round(m.tonnageKg / 100) / 10)} تُن` }] : []),
    ...(m.prs.length > 0 ? [{ icon: "Trophy", text: `${toPersianDigits(m.prs.length)} رکورد` }] : []),
    ...(m.avgReadiness != null ? [{ icon: "HeartPulse", text: `آمادگی ${toPersianDigits(m.avgReadiness)}` }] : []),
    ...(m.streakDays > 0 ? [{ icon: "Flame", text: `استریک ${toPersianDigits(m.streakDays)} روز` }] : []),
  ];

  return (
    <section aria-label="جمع‌بندی هفتگی" className="relative overflow-hidden rounded-3xl border border-border bg-surface-1 p-6">
      {/* Ambient accent */}
      <div className="pointer-events-none absolute -top-24 -end-24 h-48 w-48 rounded-full bg-primary/10 blur-3xl" aria-hidden />

      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-bold flex items-center gap-2">
            <Icon name="ScrollText" size={18} className="text-primary" />
            جمع‌بندی هوشمند هفته
          </h2>
          <p className="text-[11px] text-esi-text-muted mt-1">هفتهٔ {formatJalaliLong(recap.weekStart)}</p>
        </div>
        {recap.source === "ai" ? (
          <span className="rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[10px] font-bold shrink-0">روایت هوشمند</span>
        ) : (
          <Button variant="ghost" size="sm" className="h-8 text-[11px]" onClick={() => void enhance()} disabled={enhancing}>
            <Icon name="Sparkles" size={13} className="text-primary" />
            {enhancing ? "…" : "بازنویسی هوشمند"}
          </Button>
        )}
      </div>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="text-sm leading-7 text-esi-text-secondary"
      >
        {recap.contentFa}
      </motion.p>

      <div className="mt-4 flex flex-wrap gap-2">
        {chips.map((c, i) => (
          <motion.span
            key={c.text}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 + i * 0.06, duration: reduce ? 0 : 0.25 }}
            className={cn(
              "flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-[11px] font-semibold text-esi-text-secondary",
            )}
          >
            <Icon name={c.icon} size={12} className="text-primary" />
            {c.text}
          </motion.span>
        ))}
      </div>
    </section>
  );
}
