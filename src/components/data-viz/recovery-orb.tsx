"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { READINESS_STATE_FA } from "@/lib/domain/body-math";
import { cn } from "@/lib/utils";

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

const STATE_META: Record<ReadinessState, { color: string; glow: string; bg: string }> = {
  ready: { color: "#5BE7C4", glow: "rgba(91,231,196,0.22)", bg: "rgba(91,231,196,0.08)" },
  moderate: { color: "#70A7FF", glow: "rgba(112,167,255,0.22)", bg: "rgba(112,167,255,0.08)" },
  caution: { color: "#F5C66A", glow: "rgba(245,198,106,0.2)", bg: "rgba(245,198,106,0.08)" },
  recover: { color: "#FF7A85", glow: "rgba(255,122,133,0.2)", bg: "rgba(255,122,133,0.08)" },
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
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Ambient glow — signal not wallpaper */}
        <div
          className={cn("absolute inset-4 rounded-full blur-2xl", !reduced && state === "ready" && "esi-ambient")}
          style={{ background: meta.glow }}
          aria-hidden
        />
        <svg width={size} height={size} className="-rotate-90 relative" role="img" aria-label={`امتیاز آمادگی ${score} از ۱۰۰ — ${READINESS_STATE_FA[state]}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={10} />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={meta.color}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: reduced ? c * (1 - pct) : c }}
            animate={{ strokeDashoffset: c * (1 - pct) }}
            transition={{ duration: reduced ? 0 : 1, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <AnimatedCounter value={score} className="text-5xl font-bold tabular-nums" />
          <span className="text-sm font-medium" style={{ color: meta.color }}>
            {READINESS_STATE_FA[state]}
          </span>
        </div>
      </div>

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
