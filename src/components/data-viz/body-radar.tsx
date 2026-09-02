"use client";

import * as React from "react";
import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { MUSCLE_GROUPS } from "@/features/workouts/data/exercise-dataset";

const PATTERN_FA: Record<string, string> = {
  horizontal_push: "پرس افقی",
  vertical_push: "پرس عمودی",
  horizontal_pull: "کشش افقی",
  vertical_pull: "کشش عمودی",
  squat: "اسکات",
  hinge: "لولای لگن",
  core: "مرکز بدن",
  carry: "حمل وزنه",
  lunge: "لانج",
  conditioning: "آمادگی هوازی",
};

/**
 * BodyRadar — relative strength across movement patterns.
 * Insufficient-data state renders a deliberate message instead of an empty chart.
 */
export function BodyRadar({
  data,
  className,
}: {
  data: Array<{ pattern: string; value: number }>;
  className?: string;
}) {
  const chartData = data.map((d) => ({
    pattern: PATTERN_FA[d.pattern] ?? d.pattern,
    value: d.value,
  }));

  const hasData = chartData.some((d) => d.value > 0);
  if (!hasData) {
    return (
      <div className={`flex h-56 items-center justify-center text-sm text-esi-text-muted ${className ?? ""}`}>
        <p>با ثبت چند تمرین، رادار قدرت نسبتی شما ساخته می‌شود</p>
      </div>
    );
  }

  return (
    <div className={className} dir="ltr">
      <ResponsiveContainer width="100%" height={260}>
        <RechartsRadarChart data={chartData} outerRadius="72%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="pattern" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} />
          <Radar
            dataKey="value"
            stroke="var(--chart-2)"
            fill="var(--chart-2)"
            fillOpacity={0.25}
            strokeWidth={2}
            isAnimationActive
            animationDuration={700}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
      <p className="sr-only">
        رادار قدرت نسبی بر اساس الگوهای حرکتی: {chartData.map((d) => `${d.pattern} ${d.value}`).join("، ")}
      </p>
    </div>
  );
}
