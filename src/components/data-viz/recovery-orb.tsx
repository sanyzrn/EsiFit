"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { READINESS_STATE_FA } from "@/lib/domain/body-math";
import { cn } from "@/lib/utils";
import { KhatamDial } from "@/components/motion/khatam";

/**
 * RecoveryOrb — signature readiness visualization.
 * ALWAYS shows: numeric score + text state label + contributing factors
 * (DESIGN_BIBLE §10: never a mysterious glowing orb alone).
 * Glow only for active/success states; reduced-motion disables pulse.
 */

export type ReadinessState = "ready" | "moderate" | "caution" | "recover";

export type ReadinessFactor = {
  type: string;
  label: string;
  normalizedScore: number;
  weight: number;
  source: string;
};

const STATE_META: Record<ReadinessState, { color: string }> = {
  ready: { color: "var(--turquoise)" },
  moderate: { color: "var(--lapis)" },
  caution: { color: "var(--ember)" },
  recover: { color: "var(--coral)" },
};

export function RecoveryOrb({
  score,
  state,
  factors = [],
  isEstimated = true,
  size = 220,
  className,
}: {
  score: number;
  state: ReadinessState;
  factors?: ReadinessFactor[];
  isEstimated?: boolean;
  size?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const meta = STATE_META[state] ?? STATE_META.moderate;

  return (
    <div className={cn("flex w-full flex-col items-center gap-4", className)}>
      <KhatamDial
        value={score}
        size={size}
        color={meta.color}
        label={`امتیاز آمادگی ${score} از ۱۰۰ — ${READINESS_STATE_FA[state]}`}
      >
        <AnimatedCounter value={score} className="font-display text-[44px] leading-none tabular-nums" />
        <span className="mt-1 text-sm font-medium" style={{ color: meta.color }}>
          {READINESS_STATE_FA[state]}
        </span>
      </KhatamDial>

      {isEstimated && (
        <span className="text-[11px] text-esi-text-muted -mt-2">تخمینی — بر اساس داده‌های ثبت‌شده</span>
      )}

      {factors.length > 0 && (
        <ul className="w-full max-w-xs space-y-2.5" aria-label="عوامل مؤثر بر آمادگی">
          {factors.map((f) => (
            <li key={f.type} className="flex items-center gap-3">
              <span className="text-xs text-esi-text-secondary w-24 shrink-0">{f.label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: meta.color }}
                  initial={{ width: reduced ? `${f.normalizedScore}%` : "0%" }}
                  animate={{ width: `${f.normalizedScore}%` }}
                  transition={{ duration: reduced ? 0 : 0.8, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <span className="text-xs tabular-nums text-esi-text-muted w-8 text-left">{f.normalizedScore}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
