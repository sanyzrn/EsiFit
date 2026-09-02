"use client";

import * as React from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Icon } from "@/components/ui/icon";
import type { Insight } from "@/lib/domain/plateau";
import { cn } from "@/lib/utils";

/**
 * InsightsCard — plateau/progress insights with staggered reveal and
 * severity-toned rows. Pure display; detection runs server-side.
 */

const SEVERITY_META: Record<Insight["severity"], { icon: string; ring: string; iconClass: string }> = {
  warning: { icon: "TriangleAlert", ring: "border-amber-500/30 bg-amber-500/8", iconClass: "text-amber-500" },
  success: { icon: "TrendingUp", ring: "border-primary/30 bg-primary/8", iconClass: "text-primary" },
  info: { icon: "Info", ring: "border-border bg-surface-2", iconClass: "text-esi-text-secondary" },
};

export function InsightsCard({ insights }: { insights: Insight[] }) {
  const reduce = useReducedMotion();
  if (insights.length === 0) {
    return (
      <section aria-label="بینش‌های پیشرفت" className="rounded-3xl border border-border bg-surface-1 p-6">
        <h2 className="font-bold flex items-center gap-2 mb-2">
          <Icon name="Sparkles" size={18} className="text-primary" />
          بینش‌های پیشرفت
        </h2>
        <p className="text-sm text-esi-text-muted py-4 text-center">
          با چند جلسه ثبت‌شده بیشتر، بینش‌های تمرینی همین‌جا ظاهر می‌شوند.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="بینش‌های پیشرفت" className="rounded-3xl border border-border bg-surface-1 p-6">
      <h2 className="font-bold flex items-center gap-2 mb-1">
        <Icon name="Sparkles" size={18} className="text-primary" />
        بینش‌های پیشرفت
      </h2>
      <p className="text-xs text-esi-text-secondary mb-4">الگوهایی که موتور تحلیل از داده واقعی تو پیدا کرده است</p>

      <ul className="space-y-2.5">
        <AnimatePresence initial={false}>
          {insights.map((ins, i) => {
            const meta = SEVERITY_META[ins.severity];
            return (
              <motion.li
                key={ins.id}
                layout
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: reduce ? 0 : 0.35, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                className={cn("rounded-2xl border p-4", meta.ring)}
              >
                <div className="flex items-start gap-3">
                  <Icon name={meta.icon} size={17} className={cn("mt-0.5 shrink-0", meta.iconClass)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{ins.titleFa}</p>
                    <p className="text-xs text-esi-text-secondary mt-1 leading-5">{ins.messageFa}</p>
                    {ins.actionFa && (
                      <p className="mt-2 rounded-xl bg-surface-1/70 px-3 py-2 text-[11px] leading-5 text-esi-text-secondary">
                        <span className="font-semibold text-esi-text-primary">اقدام پیشنهادی: </span>
                        {ins.actionFa}
                      </p>
                    )}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </section>
  );
}
