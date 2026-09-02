"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * RadialGauge — determinate ring with count-in draw (DESIGN_BIBLE §11 count token).
 * Tone maps to readiness semantics when `semantic` is set.
 */

export type GaugeTone = "primary" | "blue" | "amber" | "red" | "violet" | "neutral";

const TONE_COLORS: Record<GaugeTone, string> = {
  primary: "var(--primary)",
  blue: "#4F8CFF",
  amber: "#F5C66A",
  red: "#FF7A85",
  violet: "#A99BFF",
  neutral: "var(--surface-3)",
};

export function RadialGauge({
  value,
  min = 0,
  max = 100,
  size = 160,
  strokeWidth = 12,
  tone = "primary",
  label,
  sublabel,
  children,
  className,
}: {
  value: number;
  min?: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  tone?: GaugeTone;
  label?: React.ReactNode;
  sublabel?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const pct = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const target = c * (1 - pct);

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} role="img" aria-label={`${label ?? "سنجه"}: ${Math.round(value)} از ${max}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TONE_COLORS[tone]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduced ? target : c }}
          animate={{ strokeDashoffset: target }}
          transition={{ duration: reduced ? 0 : 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3">
        {children ?? (
          <>
            {label && <span className="text-xs text-esi-text-secondary">{label}</span>}
            {sublabel && <span className="text-[11px] text-esi-text-muted mt-0.5">{sublabel}</span>}
          </>
        )}
      </div>
    </div>
  );
}
