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
import { formatJalaliLong } from "@/lib/dates/jalali";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
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
  const [loadError, setLoadError] = React.useState("");
  const [paymentAvailable, setPaymentAvailable] = React.useState(false);
  const [plans, setPlans] = React.useState<Plan[] | null>(null);
  const [effectiveTier, setEffectiveTier] = React.useState(currentTier);
  const [subscription, setSubscription] = React.useState<{ id: string; currentPeriodEndsAt: string } | null>(null);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const { toast } = useToast();
  const refresh = useSessionRefresh();

  const loadPlans = React.useCallback(async () => {
    setLoadError(""); setPlans(null);
    try {
      const res = await api<{ paymentAvailable: boolean; plans: Plan[]; currentTier: string | null; currentSubscription: { id: string; currentPeriodEndsAt: string } | null }>("/api/plans/subscribe");
      setPaymentAvailable(res.paymentAvailable); setPlans(res.plans); setEffectiveTier(res.currentTier); setSubscription(res.currentSubscription);
    } catch (error) { setLoadError(errorMessage(error)); setPlans([]); }
  }, []);
  React.useEffect(() => { void loadPlans(); }, [loadPlans]);

  const subscribe = async (code: string) => {
    setBusy(code);
    try {
      const res = await api<{ message: string }>("/api/plans/subscribe", { method: "POST", json: { planCode: code } });
      toast({ title: res.message });
      await loadPlans();
      refresh();
    } catch (e) {
      toast({ title: "فعال‌سازی ناموفق", description: errorMessage(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const cancelSubscription = async () => {
    setBusy("cancel");
    try {
      const result = await api<{ message: string }>("/api/plans/subscribe", { method: "DELETE" });
      toast({ title: result.message });
      setCancelOpen(false); await loadPlans(); refresh();
    } catch (error) {
      toast({ title: "لغو انجام نشد", description: errorMessage(error), variant: "destructive" });
    } finally { setBusy(null); }
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
      {subscription && <section aria-label="اشتراک فعال" className="mb-5 rounded-2xl border border-border bg-surface-1 p-5">
        <h2 className="font-bold">اشتراک فعال شما</h2>
        <p className="mt-2 text-sm leading-6 text-esi-text-secondary">اعتبار تا {formatJalaliLong(new Date(subscription.currentPeriodEndsAt))} · بدون تمدید خودکار</p>
        <Button variant="secondary" className="mt-3 min-h-11" disabled={busy !== null} onClick={() => setCancelOpen(true)}>لغو اشتراک و بازگشت به رایگان</Button>
      </section>}
      <AlertDialog open={cancelOpen} onOpenChange={open => { if (busy !== "cancel") setCancelOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>اشتراک لغو شود؟</AlertDialogTitle>
            <AlertDialogDescription>مزایای ویژه از همین لحظه پایان می‌یابد و حساب به پلن رایگان برمی‌گردد. داده‌ها و سفارش‌ها حفظ می‌شوند. این اقدام بازپرداخت ایجاد نمی‌کند؛ پرداخت فعلی آزمایشی است.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "cancel"}>انصراف</AlertDialogCancel>
            <AlertDialogAction disabled={busy === "cancel"} onClick={event => { event.preventDefault(); void cancelSubscription(); }}>{busy === "cancel" ? "در حال لغو…" : "تأیید لغو اشتراک"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Free plan banner */}
      <div className="mb-5 esi-card rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-bold">پلن رایگان — همیشه</h2>
          <p className="mt-1 text-sm text-esi-text-secondary">
            تمرین، ثبت تغذیه، ماشین‌حساب‌ها و دسترسی کامل به داده‌های خودتان — بدون پرداخت.
          </p>
        </div>
        <span className={cn(
          "rounded-full px-4 py-2 text-xs font-bold",
          effectiveTier === "free" || !effectiveTier ? "bg-primary text-primary-foreground" : "bg-surface-2 text-esi-text-muted",
        )}>
          {effectiveTier === "free" || !effectiveTier ? "پلن فعلی شما" : "همیشه در دسترس"}
        </span>
      </div>

      {plans.length === 0 && (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/8 p-8 text-center space-y-3">
          <p className="text-sm text-destructive">{loadError || "پلن‌های اشتراک به‌زودی در دسترس قرار می‌گیرند."}</p>
          <Button variant="secondary" onClick={() => void loadPlans()}>تلاش دوباره</Button>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p, i) => {
          const isCurrent = effectiveTier === p.tier;
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
                disabled={!paymentAvailable || isCurrent || busy !== null}
                onClick={() => void subscribe(p.code)}
              >
                {!paymentAvailable ? "پرداخت به‌زودی" : isCurrent ? `پلن فعلی (${TIER_LABELS[p.tier as keyof typeof TIER_LABELS]})` : busy === p.code ? "…" : "انتخاب پلن"}
              </Button>
              <p className="mt-2 text-center text-[10px] text-esi-text-muted">{paymentAvailable ? "پرداخت آزمایشی دمو — بدون تمدید خودکار" : "خرید آنلاین هنوز فعال نیست"}</p>
            </motion.article>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs leading-6 text-esi-text-muted max-w-xl mx-auto">
        داده‌های سلامت شما مال شماست: در همهٔ پلن‌ها، خروجی داده‌های ورزشی، سفارش‌ها و اشتراک‌ها در دسترس است. حذف حساب در این نسخه هنوز فعال نیست.
        محاسبات پایه هرگز پشت دیوار پرداخت قرار نمی‌گیرند.
      </p>
    </div>
  );
}
