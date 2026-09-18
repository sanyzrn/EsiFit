"use client";

import * as React from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icon } from "@/components/ui/icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { api, errorMessage } from "@/lib/client/api";
import { toPersianDigits, formatNumber, parseLocaleNumber } from "@/lib/formatting/numbers";
import { formatJalaliLong, addDaysISO, todayISO } from "@/lib/dates/jalali";
import { cn } from "@/lib/utils";

export type GoalCard = {
  id: string;
  type: string;
  title: string;
  unit: string;
  startDate: string;
  targetDate: string;
  status: string;
  startValue: number;
  targetValue: number;
  currentValue: number;
  percent: number;
  direction: "up" | "down";
  etaDays: number | null;
  statusFa: string;
};

const TYPE_FA: Record<string, string> = {
  weight: "وزن بدن",
  workout_frequency: "تعداد تمرین هفتگی",
  strength: "قدرت (رکورد حرکت)",
  volume: "حجم هفتگی",
  nutrition_log: "نظم تغذیه",
};

function unitFa(unit: string): string {
  const map: Record<string, string> = {
    kg: "کیلوگرم",
    session: "جلسه/هفته",
    sessions_per_week: "جلسه/هفته",
    kg_per_week: "کیلوگرم/هفته",
    days_4w: "روز در ۴ هفته",
    day: "روز",
  };
  return map[unit] ?? unit;
}

export function GoalsSection({ goals, onChanged }: { goals: GoalCard[]; onChanged: () => void }) {
  const reduce = useReducedMotion();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<string>("weight");
  const [title, setTitle] = React.useState("");
  const [target, setTarget] = React.useState("");
  const [targetDate, setTargetDate] = React.useState(() => addDaysISO(todayISO(), 56));
  const [saving, setSaving] = React.useState(false);

  const active = goals.filter((g) => g.status === "active");
  const done = goals.filter((g) => g.status === "achieved");

  const create = async () => {
    const value = parseLocaleNumber(target);
    if (value == null || value <= 0) {
      toast({ title: "مقدار نامعتبر", description: "مقدار هدف را با عدد وارد کنید.", variant: "destructive" });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate) || targetDate <= todayISO()) {
      toast({ title: "تاریخ نامعتبر", description: "تاریخ هدف باید در آینده باشد.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api("/api/goals", {
        method: "POST",
        body: JSON.stringify({ type, title: title || undefined, targetValue: value, targetDate }),
      });
      toast({ title: "هدف ثبت شد", description: "پیشرفت به‌صورت خودکار از داده‌های واقعی‌ات محاسبه می‌شود." });
      setOpen(false);
      setTitle("");
      setTarget("");
      onChanged();
    } catch (e) {
      toast({ title: "خطا", description: errorMessage(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api(`/api/goals/${id}`, { method: "DELETE" });
      onChanged();
    } catch (e) {
      toast({ title: "خطا", description: errorMessage(e), variant: "destructive" });
    }
  };

  return (
    <section aria-label="اهداف" className="rounded-3xl border border-border bg-surface-1 p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="font-bold flex items-center gap-2">
            <Icon name="Target" size={18} className="text-primary" />
            اهداف من
          </h2>
          <p className="text-xs text-esi-text-secondary mt-1">پیشرفت هر هدف مستقیم از داده‌های تمرین و اندازه‌گیری‌ها محاسبه می‌شود.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-9">
              <Icon name="Plus" size={14} />
              هدف جدید
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>هدف جدید</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label htmlFor="goal-type">نوع هدف</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger id="goal-type" className="h-11 mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_FA).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="goal-target">مقدار هدف</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Input
                    id="goal-target"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    inputMode="decimal"
                    placeholder={type === "weight" ? "مثلاً ۷۸" : type === "workout_frequency" ? "مثلاً ۴" : "مثلاً ۱۰۰"}
                    className="h-11 tabular-nums"
                  />
                  <span className="text-xs text-esi-text-muted whitespace-nowrap">
                    {type === "weight" ? "کیلوگرم" : type === "workout_frequency" ? "جلسه در هفته" : type === "strength" ? "کیلوگرم (۱RM)" : type === "volume" ? "کیلوگرم/هفته" : "روز در ۴ هفته"}
                  </span>
                </div>
                {type === "weight" && (
                  <p className="text-[10px] text-esi-text-muted mt-1.5">
                    برای کاهش وزن عددی کمتر از وزن فعلی وارد کنید؛ جهت هدف خودکار تشخیص داده می‌شود.
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="goal-date">تاریخ هدف</Label>
                <Input
                  id="goal-date"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="h-11 mt-1.5"
                  dir="ltr"
                />
              </div>
              <div>
                <Label htmlFor="goal-title">عنوان (اختیاری)</Label>
                <Input id="goal-title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 mt-1.5" placeholder="مثلاً: رسیدن به وزن هدف تا پایان فصل" />
              </div>
              <Button onClick={() => void create()} disabled={saving} className="w-full h-11 esi-glow">
                {saving ? "…" : "ثبت هدف"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {active.length === 0 && done.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
          <Icon name="Target" size={26} className="mx-auto text-esi-text-muted" />
          <p className="mt-3 text-sm font-semibold">هنوز هدفی نساخته‌اید</p>
          <p className="mt-1 text-xs text-esi-text-muted">یک هدف کوچک و قابل‌اندازه‌گیری انتخاب کنید — مثلاً ۳ جلسه در هفته.</p>
        </div>
      )}

      <ul className="space-y-4">
        <AnimatePresence initial={false}>
          {[...active, ...done].map((g) => (
            <motion.li
              key={g.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: reduce ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl bg-surface-2 p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{g.title || (TYPE_FA[g.type] ?? g.type)}</p>
                  <p className="text-[11px] text-esi-text-muted mt-0.5">
                    {TYPE_FA[g.type]} • هدف: {formatNumber(g.targetValue, { maximumFractionDigits: 1 })} {unitFa(g.unit)} • {formatJalaliLong(g.targetDate)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {g.status === "achieved" ? (
                    <span className="rounded-full bg-emerald-500/15 text-emerald-500 px-2.5 py-1 text-[10px] font-bold">محقق شد ✓</span>
                  ) : (
                    <span className="text-sm font-extrabold tabular-nums">{toPersianDigits(g.percent)}٪</span>
                  )}
                  <button
                    type="button"
                    onClick={() => void remove(g.id)}
                    className="rounded-full p-1.5 text-esi-text-muted hover:text-destructive transition-colors"
                    aria-label={`حذف هدف ${g.title}`}
                  >
                    <Icon name="Trash2" size={13} />
                  </button>
                </div>
              </div>
              <div className="h-2.5 rounded-full bg-surface-3 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${g.percent}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: reduce ? 0 : 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    "h-full rounded-full",
                    g.status === "achieved" ? "bg-emerald-500" : "esi-gradient-brand",
                  )}
                />
              </div>
              <p className="mt-2 text-[11px] text-esi-text-secondary">{g.statusFa}</p>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}
