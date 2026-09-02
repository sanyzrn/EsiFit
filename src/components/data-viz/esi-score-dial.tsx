"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import type { EsiScoreResult } from "@/lib/domain/esi-score";
import { toPersianDigits } from "@/lib/formatting/numbers";
import { cn } from "@/lib/utils";

/**
 * EsiScoreDial — the explainable composite progress dial.
 * Animated needle sweep + arced factor bars; every factor is visible so the
 * score is never mysterious (DESIGN_BIBLE rule).
 */

const ARC_R = 78;
const ARC_LEN = Math.PI * ARC_R; // half circle

const BAND_TONE: Record<string, string> = {
  starting: "text-esi-text-secondary",
  building: "text-primary",
  strong: "text-primary",
  elite: "text-amber-400",
};

export function EsiScoreDial({ score, className }: { score: EsiScoreResult; className?: string }) {
  const reduce = useReducedMotion();
  const pct = Math.min(100, Math.max(0, score.score)) / 100;

  return (
    <div className={cn("flex flex-col sm:flex-row items-center gap-6", className)}>
      {/* Dial */}
      <div className="relative shrink-0" style={{ width: 200, height: 122 }} role="img" aria-label={`امتیاز اسی: ${score.score} از ۱۰۰ — سطح ${score.bandFa}`}>
        <svg viewBox="0 0 200 122" className="w-full h-full">
          {/* Track */}
          <path
            d="M 22 100 A 78 78 0 0 1 178 100"
            fill="none"
            stroke="var(--surface-3)"
            strokeWidth={14}
            strokeLinecap="round"
          />
          {/* Value arc */}
          <motion.path
            d="M 22 100 A 78 78 0 0 1 178 100"
            fill="none"
            stroke="var(--primary)"
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={ARC_LEN}
            initial={{ strokeDashoffset: ARC_LEN }}
            animate={{ strokeDashoffset: ARC_LEN * (1 - pct) }}
            transition={{ duration: reduce ? 0 : 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          />
          {/* Ticks */}
          {[0, 25, 50, 75, 100].map((t) => {
            const angle = Math.PI - (Math.PI * t) / 100;
            const x1 = 100 + Math.cos(angle) * (ARC_R - 12);
            const y1 = 100 - Math.sin(angle) * (ARC_R - 12);
            const x2 = 100 + Math.cos(angle) * (ARC_R - 20);
            const y2 = 100 - Math.sin(angle) * (ARC_R - 20);
            return (
              <line
                key={t}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="var(--border)"
                strokeWidth={1.5}
              />
            );
          })}
        </svg>
        {/* Needle */}
        <motion.div
          className="absolute left-1/2 bottom-[6px] origin-bottom"
          style={{ width: 3, height: 64, transformOrigin: "50% 100%", x: "-50%" }}
          initial={{ rotate: -90 }}
          animate={{ rotate: -90 + pct * 180 }}
          transition={{ duration: reduce ? 0 : 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        >
          <div className="w-full h-full rounded-full esi-gradient-brand" />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-primary shadow-[0_0_10px_var(--primary)]" />
        </motion.div>
        {/* Score */}
        <div className="absolute inset-x-0 bottom-0 text-center">
          <p className="text-4xl font-extrabold tabular-nums leading-none">
            <AnimatedCounter value={score.score} />
          </p>
        </div>
      </div>

      {/* Factors */}
      <div className="flex-1 w-full space-y-2.5" aria-label="عوامل تشکیل‌دهنده امتیاز">
        <div className="flex items-center justify-between">
          <p className={cn("text-sm font-bold", BAND_TONE[score.band])}>سطح: {score.bandFa}</p>
          <span className="text-[10px] text-esi-text-muted">از ۱۰۰</span>
        </div>
        {score.factors.map((f, i) => (
          <div key={f.key}>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-medium" title={f.hintFa}>{f.labelFa}</span>
              <span className="tabular-nums text-esi-text-secondary">
                {toPersianDigits(f.value)}
                <span className="text-esi-text-muted ms-1">وزن {toPersianDigits(Math.round(f.weight * 100))}٪</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${f.value}%` }}
                transition={{ duration: reduce ? 0 : 0.7, delay: 0.25 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "h-full rounded-full",
                  f.value >= 65 ? "esi-gradient-brand" : f.value >= 40 ? "bg-amber-500" : "bg-destructive/70",
                )}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
