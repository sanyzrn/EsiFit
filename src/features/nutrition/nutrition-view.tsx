"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/layout/app-shell";
import { MacroRingGroup } from "@/components/data-viz/macro-rings";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/client/api";
import { enqueueOperation, newClientId } from "@/lib/offline/adapter";
import { useFeatureFlag } from "@/lib/feature-flags/flag-provider";
import { formatNumber, toPersianDigits } from "@/lib/formatting/numbers";
import { formatJalaliLong } from "@/lib/dates/jalali";
import { cn } from "@/lib/utils";

type DayData = {
  date: string;
  totals: { calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number };
  targets: { calories: number; proteinG: number; carbsG: number; fatG: number } | null;
  water: { ml: number; targetMl: number };
  slots: Record<string, MealItem[]>;
  yesterdayCalories: number;
};

type MealItem = {
  id: string;
  foodName: string;
  emoji: string;
  quantity: number;
  servingUnit: string;
  servingAmount: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

type FoodResult = {
  id: string;
  nameFa: string;
  category: string;
  servingAmount: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

const SLOTS = [
  { key: "breakfast", label: "صبحانه", emoji: "🌅" },
  { key: "lunch", label: "ناهار", emoji: "☀️" },
  { key: "snack", label: "میان‌وعده", emoji: "🥜" },
  { key: "dinner", label: "شام", emoji: "🌙" },
] as const;

export function NutritionView() {
  const [date, setDate] = React.useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [data, setData] = React.useState<DayData | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState<string | null>(null);
  const offline = useFeatureFlag("OFFLINE_TRACKERS");

  const load = React.useCallback(async (d: string) => {
    try {
      const res = await api<DayData>(`/api/nutrition/day?date=${d}`);
      setData(res);
    } catch {
      setData(null);
    }
  }, []);

  React.useEffect(() => {
    void load(date);
  }, [date, load]);

  const removeEntry = async (id: string) => {
    setData((d) =>
      d
        ? {
            ...d,
            slots: Object.fromEntries(
              Object.entries(d.slots).map(([k, v]) => [k, v.filter((x) => x.id !== id)]),
            ),
          }
        : d,
    );
    try {
      await api("/api/nutrition/day", { method: "DELETE", json: { entryId: id } });
      await load(date);
    } catch {
      await load(date);
    }
  };

  const addWater = async (ml: number) => {
    const clientId = newClientId("water");
    setData((d) => (d ? { ...d, water: { ...d.water, ml: d.water.ml + ml } } : d));
    try {
      await api("/api/water", { method: "POST", json: { ml, clientId } });
    } catch {
      if (offline) await enqueueOperation({ clientId, kind: "water", endpoint: "/api/water", payload: { ml, clientId } });
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full pb-6">
      <PageHeader
        title="تغذیه"
        description={formatJalaliLong(new Date())}
        action={
          <div className="flex gap-1.5">
            <Button
              variant="secondary"
              size="icon"
              className="h-10 w-10"
              aria-label="روز قبل"
              onClick={() => {
                const d = new Date(date);
                d.setDate(d.getDate() - 1);
                setDate(d.toISOString().slice(0, 10));
              }}
            >
              <Icon name="ChevronRight" size={18} />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-10 w-10"
              aria-label="روز بعد"
              disabled={date >= new Date().toISOString().slice(0, 10)}
              onClick={() => {
                const d = new Date(date);
                d.setDate(d.getDate() + 1);
                setDate(d.toISOString().slice(0, 10));
              }}
            >
              <Icon name="ChevronLeft" size={18} />
            </Button>
          </div>
        }
      />

      <div className="px-4 lg:px-8 space-y-5">
        {/* rings */}
        {data ? (
          <section aria-label="خلاصه روز" className="rounded-3xl border border-border bg-surface-1 p-6">
            <MacroRingGroup totals={data.totals} targets={data.targets} size={96} />
            <p className="mt-5 text-center text-xs text-esi-text-muted">
              دیروز {formatNumber(data.yesterdayCalories)} کیلوکالری ثبت کرده بودید
            </p>
          </section>
        ) : (
          <Skeleton className="h-44 rounded-3xl" />
        )}

        {/* water */}
        {data && (
          <section aria-label="آب" className="rounded-3xl border border-border bg-surface-1 p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold flex items-center gap-2">
                <Icon name="Droplets" size={18} className="text-blue-500" />
                آب
              </h2>
              <p className="text-sm tabular-nums text-esi-text-secondary">
                {(data.water.ml / 1000).toLocaleString("fa-IR", { maximumFractionDigits: 2 })} / {(data.water.targetMl / 1000).toLocaleString("fa-IR")} لیتر
              </p>
            </div>
            <div className="h-2.5 rounded-full bg-surface-3 overflow-hidden">
              <motion.div
                className="h-full bg-blue-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (data.water.ml / data.water.targetMl) * 100)}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {[150, 250, 500, 750].map((ml) => (
                <button
                  key={ml}
                  type="button"
                  onClick={() => void addWater(ml)}
                  className="min-h-11 rounded-xl border border-border bg-surface-2 text-sm font-medium tabular-nums hover:border-blue-500/50 active:scale-95 transition-all"
                >
                  +{toPersianDigits(ml)}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* meal slots */}
        {data &&
          SLOTS.map((slot) => {
            const items = data.slots[slot.key] ?? [];
            const slotCalories = items.reduce((a, i) => a + i.calories, 0);
            return (
              <section key={slot.key} aria-label={slot.label} className="rounded-3xl border border-border bg-surface-1 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold flex items-center gap-2">
                    <span aria-hidden>{slot.emoji}</span>
                    {slot.label}
                    {items.length > 0 && (
                      <span className="text-xs font-normal text-esi-text-muted tabular-nums">
                        {formatNumber(slotCalories)} kcal
                      </span>
                    )}
                  </h2>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-9"
                    onClick={() => setPickerOpen(slot.key)}
                  >
                    <Icon name="Plus" size={16} />
                    افزودن
                  </Button>
                </div>
                {items.length === 0 ? (
                  <p className="rounded-xl bg-surface-2 px-4 py-3 text-xs text-esi-text-muted">
                    برای این وعده چیزی ثبت نشده است.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    <AnimatePresence>
                      {items.map((item) => (
                        <motion.li
                          key={item.id}
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -12 }}
                          className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-3"
                        >
                          <span className="text-xl shrink-0" aria-hidden>{item.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{item.foodName}</p>
                            <p className="text-[11px] text-esi-text-muted tabular-nums">
                              {toPersianDigits(item.quantity)} × {toPersianDigits(item.servingAmount)} {item.servingUnit} • پ {toPersianDigits(item.proteinG)} / ک {toPersianDigits(item.carbsG)} / چ {toPersianDigits(item.fatG)}
                            </p>
                          </div>
                          <span className="text-sm font-bold tabular-nums shrink-0">{formatNumber(item.calories)}</span>
                          <button
                            type="button"
                            onClick={() => void removeEntry(item.id)}
                            aria-label={`حذف ${item.foodName}`}
                            className="h-9 w-9 shrink-0 rounded-full text-esi-text-muted hover:text-destructive transition-colors"
                          >
                            <Icon name="Trash2" size={15} className="mx-auto" />
                          </button>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </section>
            );
          })}
      </div>

      {/* food picker sheet */}
      <AnimatePresence>
        {pickerOpen && data && (
          <FoodPicker
            slotKey={pickerOpen}
            date={data.date}
            onClose={() => setPickerOpen(null)}
            onAdded={() => {
              setPickerOpen(null);
              void load(date);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function FoodPicker({
  slotKey,
  date,
  onClose,
  onAdded,
}: {
  slotKey: string;
  date: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const [foods, setFoods] = React.useState<FoodResult[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<FoodResult | null>(null);
  const [quantity, setQuantity] = React.useState("۱");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await api<{ foods: FoodResult[] }>(`/api/nutrition/foods?q=${encodeURIComponent(query)}`);
        if (!cancelled) setFoods(res.foods);
      } catch {
        if (!cancelled) setFoods([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const confirm = async () => {
    if (!selected) return;
    const q = parseFloat(quantity.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))) || 1;
    setSaving(true);
    setError(null);
    const clientId = newClientId("meal");
    try {
      await api("/api/nutrition/day", {
        method: "POST",
        json: { date, foodId: selected.id, mealSlot: slotKey, quantity: q, clientId },
      });
      onAdded();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="افزودن غذا"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        exit={{ y: 80 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="w-full sm:max-w-lg max-h-[85dvh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-border bg-surface-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border flex items-center justify-between shrink-0">
          <h3 className="font-bold">افزودن غذا</h3>
          <button type="button" onClick={onClose} aria-label="بستن" className="h-10 w-10 rounded-full bg-surface-2 flex items-center justify-center">
            <Icon name="X" size={18} />
          </button>
        </div>

        <div className="p-4 border-b border-border shrink-0">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجو: چلوکباب، مرغ، برنج…"
            className="h-11"
            autoFocus
            aria-label="جستجوی غذا"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-3 max-h-72" role="listbox" aria-label="نتایج غذا">
          {loading ? (
            <div className="space-y-2 p-1">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : foods.length === 0 ? (
            <p className="py-8 text-center text-sm text-esi-text-muted">غذایی پیدا نشد</p>
          ) : (
            foods.map((f) => (
              <button
                key={f.id}
                type="button"
                role="option"
                aria-selected={selected?.id === f.id}
                onClick={() => setSelected(f)}
                className={cn(
                  "w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-start transition-colors",
                  selected?.id === f.id ? "bg-primary/10" : "hover:bg-surface-2",
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{f.nameFa}</p>
                  <p className="text-[11px] text-esi-text-muted tabular-nums">
                    {toPersianDigits(f.servingAmount)} {f.servingUnit} • پ {toPersianDigits(f.proteinG)} / ک {toPersianDigits(f.carbsG)} / چ {toPersianDigits(f.fatG)}
                  </p>
                </div>
                <span className="text-sm font-bold tabular-nums shrink-0">{formatNumber(f.calories)}</span>
              </button>
            ))
          )}
        </div>

        {selected && (
          <div className="border-t border-border p-4 shrink-0">
            <div className="flex items-center gap-3">
              <label htmlFor="qty" className="text-sm shrink-0">مقدار (سرو):</label>
              <input
                id="qty"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-11 w-20 rounded-xl border border-border bg-surface-2 text-center tabular-nums outline-none focus:border-primary"
              />
              <Button className="flex-1 h-11" onClick={() => void confirm()} disabled={saving}>
                {saving ? "…" : "افزودن به وعده"}
              </Button>
            </div>
            {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
