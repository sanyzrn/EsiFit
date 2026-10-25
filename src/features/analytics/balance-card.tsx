"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { Icon } from "@/components/ui/icon";
import { formatNumber, toPersianDigits } from "@/lib/formatting/numbers";
import { cn } from "@/lib/utils";
import type { BalancePair } from "@/lib/domain/balance";

const STATUS_TONE: Record<BalancePair["status"], { color: string; labelFa: string }> = {
  balanced: { color: "var(--turquoise)", labelFa: "متعادل" },
  lean_a: { color: "var(--ember)", labelFa: "نامتعادل" },
  lean_b: { color: "var(--ember)", labelFa: "نامتعادل" },
  insufficient: { color: "var(--text-muted)", labelFa: "داده کم" },
};

/** One opposing pair as a split bar: whichever side is bigger takes more of the track. */
function PairRow({ pair, index }: { pair: BalancePair; index: number }) {
  const reduce = useReducedMotion();
  const total = pair.aSets + pair.bSets;
  const aPct = total > 0 ? (pair.aSets / total) * 100 : 50;
  const tone = STATUS_TONE[pair.status];
  return (
    <li>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{pair.titleFa}</p>
        <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ color: tone.color, background: `color-mix(in srgb, ${tone.color} 14%, transparent)` }}>
          {tone.labelFa}
        </span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${pair.aLabelFa} ${pair.aSets} ست در هفته، ${pair.bLabelFa} ${pair.bSets} ست در هفته`}>
        <motion.div
          className="h-full bg-lapis"
          initial={{ width: reduce ? `${aPct}%` : "50%" }}
          animate={{ width: `${aPct}%` }}
          transition={{ duration: reduce ? 0 : 0.9, delay: 0.1 + index * 0.1, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="h-full flex-1 bg-turquoise" />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] tabular-nums text-esi-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-lapis" aria-hidden />
          {pair.aLabelFa} {formatNumber(pair.aSets, { maximumFractionDigits: 1 })} ست
        </span>
        <span className="flex items-center gap-1.5">
          {pair.bLabelFa} {formatNumber(pair.bSets, { maximumFractionDigits: 1 })} ست
          <span className="h-2 w-2 rounded-full bg-turquoise" aria-hidden />
        </span>
      </div>
      <p className={cn("mt-2 text-xs leading-6", pair.status === "balanced" ? "text-esi-text-muted" : "text-esi-text-secondary")}>{pair.noteFa}</p>
    </li>
  );
}

export function BalanceCard({ pairs }: { pairs: BalancePair[] }) {
  if (pairs.length === 0) return null;
  return (
    <section aria-label="تعادل ساختاری" className="esi-card rounded-3xl p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold flex items-center gap-2">
            <Icon name="Activity" size={17} className="text-primary" />
            تعادل ساختاری
          </h2>
          <p className="mt-1 text-xs text-esi-text-secondary">
            میانگین ست‌های هفتگی ۴ هفته اخیر در برابر عضله مقابل — راهنمایی برای پیشگیری از عدم‌تعادل، نه تشخیص.
          </p>
        </div>
        <span className="hidden sm:block rounded-full bg-surface-2 px-3 py-1.5 text-[11px] text-esi-text-muted">{toPersianDigits(28)} روز اخیر</span>
      </div>
      <ul className="mt-5 space-y-6">
        {pairs.map((p, i) => (
          <PairRow key={p.key} pair={p} index={i} />
        ))}
      </ul>
    </section>
  );
}
