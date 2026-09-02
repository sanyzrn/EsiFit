"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/ui/icon";
import { api, errorMessage } from "@/lib/client/api";
import { useToast } from "@/hooks/use-toast";
import { useSessionRefresh } from "@/lib/client/use-session";
import { formatToman, toPersianDigits } from "@/lib/formatting/numbers";
import { TIER_LABELS } from "@/lib/entitlements/entitlements";
import { cn } from "@/lib/utils";

type Plan = {
  id: string;
  code: string;
  tier: string;
  nameFa: string;
  billingPeriod: string;
  priceToman: number;
  featuresFa: string[];
  highlight: boolean;
};

export function PlansView({ currentTier }: { currentTier: string | null }) {
  const [plans, setPlans] = React.useState<Plan[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const { toast } = useToast();
  const refresh = useSessionRefresh();

  React.useEffect(() => {
    void (async () => {
      try {
        const res = await api<{ plans: Plan[] }>("/api/plans/subscribe");
        setPlans(res.plans);
      } catch {
        setPlans([]);
      }
    })();
  }, []);

  const subscribe = async (code: string) => {
    setBusy(code);
    try {
      const res = await api<{ message: string }>("/api/plans/subscribe", { method: "POST", json: { planCode: code } });
      toast({ title: res.message });
      await refresh();
    } catch (e) {
      toast({ title: "فعال‌سازی ناموفق", description: errorMessage(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  if (!plans) {
    return (
      <div className="px-4 lg:px-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-96 rounded-3xl" />)}
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-8 pb-8 max-w-6xl mx-auto">
      {/* Free plan banner */}
      <div className="mb-5 rounded-3xl border border-border bg-surface-1 p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-bold">پلن رایگان — همیشه</h2>
          <p className="mt-1 text-sm text-esi-text-secondary">
            تمرین، ثبت تغذیه، ماشین‌حساب‌ها و دسترسی کامل به داده‌های خودتان — بدون پرداخت.
          </p>
        </div>
        <span className={cn(
          "rounded-full px-4 py-2 text-xs font-bold",
          currentTier === "free" || !currentTier ? "bg-primary text-primary-foreground" : "bg-surface-2 text-esi-text-muted",
        )}>
          {currentTier === "free" || !currentTier ? "پلن فعلی شما" : "همیشه در دسترس"}
        </span>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p, i) => {
          const isCurrent = currentTier === p.tier;
          return (
            <motion.article
              key={p.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={cn(
                "relative flex flex-col rounded-3xl border p-6",
                p.highlight ? "border-primary/60 bg-surface-1 shadow-[var(--shadow-raised)]" : "border-border bg-surface-1",
                isCurrent && "ring-2 ring-primary/50",
              )}
            >
              {p.highlight && (
                <span className="absolute -top-3 start-6 rounded-full esi-gradient-brand px-3 py-1 text-[10px] font-bold text-primary-foreground">
                  محبوب‌ترین
                </span>
              )}
              <h3 className="font-bold">{p.nameFa}</h3>
              <p className="mt-3">
                <span className="text-2xl font-extrabold tabular-nums">{formatToman(p.priceToman)}</span>
                <span className="text-xs text-esi-text-muted ms-1">/ {p.billingPeriod === "yearly" ? "سالانه" : "ماهانه"}</span>
              </p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {p.featuresFa.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs leading-5 text-esi-text-secondary">
                    <Icon name="Check" size={14} className="text-primary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className={cn("mt-6 h-11 w-full", p.highlight && "esi-glow")}
                variant={isCurrent ? "secondary" : "default"}
                disabled={isCurrent || busy === p.code}
                onClick={() => void subscribe(p.code)}
              >
                {isCurrent ? `پلن فعلی (${TIER_LABELS[p.tier as keyof typeof TIER_LABELS]})` : busy === p.code ? "…" : "انتخاب پلن"}
              </Button>
              <p className="mt-2 text-center text-[10px] text-esi-text-muted">پرداخت آزمایشی دمو — لغو در هر زمان</p>
            </motion.article>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs leading-6 text-esi-text-muted max-w-xl mx-auto">
        داده‌های سلامت شما مال شماست: در همه پلن‌ها، خروجی داده و حذف حساب بدون محدودیت در دسترس است.
        محاسبات پایه هرگز پشت دیگری پرداخت قرار نمی‌گیرند.
      </p>
    </div>
  );
}
