"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/formatting/numbers";
import { AnimatedCounter } from "@/components/ui/animated-counter";

/**
 * MacroRingGroup — daily/meal macro totals vs targets.
 * Colors: calories=primary, protein=blue, carbs=amber, fat=violet.
 * Always paired with numeric values (never color-only).
 */

const RINGS = [
  { key: "calories", label: "کالری", color: "var(--primary)", unit: "کالری" },
  { key: "proteinG", label: "پروتئین", color: "#4F8CFF", unit: "گرم" },
  { key: "carbsG", label: "کربوهیدرات", color: "#F5C66A", unit: "گرم" },
  { key: "fatG", label: "چربی", color: "#A99BFF", unit: "گرم" },
] as const;

export function MacroRingGroup({
  totals,
  targets,
  size = 92,
  className,
}: {
  totals: { calories: number; proteinG: number; carbsG: number; fatG: number };
  targets: { calories: number; proteinG: number; carbsG: number; fatG: number } | null;
  size?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const strokeWidth = 8;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className={cn("grid grid-cols-2 gap-4 sm:grid-cols-4", className)}>
      {RINGS.map((ring) => {
        const value = totals[ring.key] ?? 0;
        const target = targets?.[ring.key] ?? 0;
        const pct = target > 0 ? Math.min(1, value / target) : 0;
        const over = target > 0 && value > target * 1.05;
        const color = over ? "var(--destructive)" : ring.color;
        return (
          <div key={ring.key} className="flex flex-col items-center gap-1.5">
            <div className="relative" style={{ width: size, height: size }}>
              <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${ring.label}: ${Math.round(value)} از ${Math.round(target)} ${ring.unit}`}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={strokeWidth} />
                <motion.circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={c}
                  initial={{ strokeDashoffset: reduced ? c * (1 - pct) : c }}
                  animate={{ strokeDashoffset: c * (1 - pct) }}
                  transition={{ duration: reduced ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn("font-semibold tabular-nums", target > 0 && pct >= 1 ? "text-xs" : "text-sm")}>
                  <AnimatedCounter value={value} format="decimal" digits={0} />
                </span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs font-medium text-esi-text-secondary">{ring.label}</div>
              <div className="text-[11px] text-esi-text-muted tabular-nums">
                از {formatNumber(target, { maximumFractionDigits: 0 })} {ring.unit}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
