"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";

const EQUIPMENT_FA: Record<string, string> = {
  barbell: "هالتر", dumbbell: "دمبل", machine: "دستگاه", cable: "سیم‌کش",
  bodyweight: "وزن بدن", kettlebell: "کتل‌بل", band: "کش", cardio: "کاردیو",
};

export function ExerciseCard({
  exercise,
  onOpen,
}: {
  exercise: {
    id: string;
    name: string;
    equipment: string;
    difficulty: string;
    muscles: Array<{ name: string; role: string }>;
  };
  onOpen: () => void;
}) {
  const primary = exercise.muscles.filter((m) => m.role === "primary").map((m) => m.name);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group text-start rounded-2xl border border-border bg-surface-1 p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[var(--shadow-raised)] min-h-11"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold leading-6">{exercise.name}</h3>
        <span className="rounded-lg bg-surface-2 px-2 py-1 text-[10px] text-esi-text-muted shrink-0">
          {EQUIPMENT_FA[exercise.equipment] ?? exercise.equipment}
        </span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {primary.slice(0, 2).map((m) => (
          <Badge key={m} variant="success" className="text-[10px]">{m}</Badge>
        ))}
      </div>
    </button>
  );
}
