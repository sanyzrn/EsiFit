/**
 * Load progression & warm-up maths — pure functions, no I/O.
 *
 * Double progression: stay at a load until every working set reaches the top of
 * the prescribed rep range (without grinding), then add the smallest practical
 * increment and drop back to the bottom of the range. This is the standard,
 * widely-taught rule; the thresholds below are EsiFit's own.
 */

export type LoggedSet = {
  weightKg: number | null;
  reps: number | null;
  rpe?: number | null;
  isWarmup?: boolean;
};

export type LoadSuggestion = {
  weightKg: number | null;
  reps: number | null;
  /** progress = add load · repeat = same load, aim for more reps · reload = start over from the bar/last known */
  kind: "progress" | "repeat" | "start";
  reasonFa: string;
};

/** Smallest jump that is physically loadable for each equipment type. */
export function incrementFor(equipment: string): number {
  switch (equipment) {
    case "dumbbell":
    case "kettlebell":
      return 2;
    case "barbell":
    case "machine":
    case "cable":
      return 2.5;
    default:
      return 1;
  }
}

const round = (v: number, step: number) => Math.round(v / step) * step;
const clean = (v: number) => Math.round(v * 100) / 100;

/** A set where the lifter had nothing left (RPE ≥ 9.5) does not earn a load jump. */
const GRIND_RPE = 9.5;

export function suggestNextLoad(input: {
  lastSets: LoggedSet[];
  repsMin: number;
  repsMax: number;
  equipment: string;
}): LoadSuggestion {
  const working = input.lastSets.filter(
    (s) => !s.isWarmup && s.weightKg != null && s.reps != null && s.reps > 0,
  );
  if (working.length === 0) {
    return { weightKg: null, reps: null, kind: "start", reasonFa: "سابقه‌ای برای این حرکت نیست — با وزن سبک شروع کنید." };
  }

  const inc = incrementFor(input.equipment);
  // The heaviest load used is the "working weight"; lighter sets are back-offs.
  const topWeight = Math.max(...working.map((s) => s.weightKg as number));
  const atTop = working.filter((s) => s.weightKg === topWeight);
  const minReps = Math.min(...atTop.map((s) => s.reps as number));
  const grinded = atTop.some((s) => s.rpe != null && s.rpe >= GRIND_RPE);

  if (minReps >= input.repsMax && !grinded) {
    // A barbell can only be loaded in whole plate steps — snap to the grid, never below a real increase.
    const raw = topWeight + inc;
    const next = input.equipment === "barbell" ? Math.max(round(raw, inc), topWeight + inc / 2) : raw;
    return {
      weightKg: clean(next),
      reps: input.repsMin,
      kind: "progress",
      reasonFa: `همه ست‌ها به ${input.repsMax} تکرار رسید — ${inc} کیلو اضافه کنید.`,
    };
  }
  if (minReps >= input.repsMax && grinded) {
    return {
      weightKg: clean(topWeight),
      reps: input.repsMax,
      kind: "repeat",
      reasonFa: "به سقف تکرار رسیدید ولی ست‌ها سنگین بود — یک بار دیگر همین وزن را سبک‌تر بزنید.",
    };
  }
  return {
    weightKg: clean(topWeight),
    reps: Math.min(input.repsMax, Math.max(minReps + 1, input.repsMin)),
    kind: "repeat",
    reasonFa: `همین وزن؛ هدف یک تکرار بیشتر از دفعه قبل (${minReps}).`,
  };
}

// ---------------------------------------------------------------- plates

export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

export type PlateBreakdown = {
  perSide: number[];
  /** kg that cannot be loaded with the available plates (per whole bar). */
  remainderKg: number;
  /** Actual loaded total = bar + 2 × per-side plates. */
  loadedKg: number;
};

/** Greedy plate loading per side. Greedy is optimal for the usual plate sets. */
export function platesPerSide(
  targetKg: number,
  barKg = 20,
  available: readonly number[] = DEFAULT_PLATES_KG,
): PlateBreakdown {
  const sorted = [...available].sort((a, b) => b - a);
  let side = Math.max(0, (targetKg - barKg) / 2);
  const perSide: number[] = [];
  for (const plate of sorted) {
    while (side + 1e-9 >= plate) {
      perSide.push(plate);
      side -= plate;
    }
  }
  const loaded = barKg + 2 * perSide.reduce((a, b) => a + b, 0);
  return {
    perSide,
    remainderKg: clean(Math.max(0, targetKg - loaded)),
    loadedKg: clean(loaded),
  };
}

// --------------------------------------------------------------- warm-up

export type WarmupSet = { weightKg: number; reps: number };

/**
 * Warm-up ramp toward a working weight: lighter and more reps first, never
 * heavy enough to tire. Skipped entirely when the working weight is at or
 * below the empty bar.
 */
export function warmupRamp(workKg: number, opts: { barKg?: number; step?: number } = {}): WarmupSet[] {
  const bar = opts.barKg ?? 20;
  const step = opts.step ?? 2.5;
  if (!Number.isFinite(workKg) || workKg <= bar) return [];
  const ramp: Array<[number, number]> = [
    [0.4, 8],
    [0.6, 5],
    [0.8, 3],
  ];
  const sets: WarmupSet[] = [];
  const first = Math.max(bar, round(workKg * ramp[0][0], step));
  sets.push({ weightKg: first, reps: 10 });
  for (const [pct, reps] of ramp) {
    const w = round(workKg * pct, step);
    const prev = sets[sets.length - 1].weightKg;
    if (w > prev && w < workKg) sets.push({ weightKg: w, reps });
  }
  return sets;
}
